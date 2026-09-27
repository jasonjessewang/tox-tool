"""
Thin client for the NIH/NLM PubChem PUG REST + PUG-View APIs (fully open, no key).

PubChem aggregates data from EPA CompTox, GHS classifications (OSHA/UN), and NLM's
Hazardous Substances Data Bank (HSDB) — all public-domain U.S. government sources.
We use it to verify a substance's identity (CID, CAS number) and pull its official
GHS hazard statements, giving the local database a live, re-checkable link to primary
government hazard data rather than a static hand-typed claim.
"""
import json
import re
import time
import urllib.request
import urllib.parse
import urllib.error

PUG_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"
PUG_VIEW_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view"
USER_AGENT = "exposure-awareness-tool/0.1 (educational, local single-user; contact: n/a)"

MIN_REQUEST_INTERVAL = 0.3
_last_request_time = [0.0]


def _throttle():
    elapsed = time.time() - _last_request_time[0]
    if elapsed < MIN_REQUEST_INTERVAL:
        time.sleep(MIN_REQUEST_INTERVAL - elapsed)
    _last_request_time[0] = time.time()


# PubChem's PUG-View endpoint in particular returns 503 ("ServerBusy") under routine
# load -- encountered firsthand running this sync, where a handful of substances failed
# transiently and needed a manual `--only <id>` re-run to pick up. Retrying with backoff
# here is what makes this script safe to run unattended (e.g. from cron) instead of
# needing a human to notice and re-invoke it for the substances that got unlucky.
RETRY_STATUS = {503, 429}
MAX_RETRIES = 4


def _get_json(url):
    for attempt in range(MAX_RETRIES + 1):
        _throttle()
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code in RETRY_STATUS and attempt < MAX_RETRIES:
                time.sleep(2**attempt)  # 1s, 2s, 4s, 8s
                continue
            raise
        except (urllib.error.URLError, TimeoutError):
            if attempt < MAX_RETRIES:
                time.sleep(2**attempt)
                continue
            raise


def get_cid(name):
    """Resolve a compound name to a PubChem CID. Returns None if not found."""
    url = f"{PUG_BASE}/compound/name/{urllib.parse.quote(name)}/cids/JSON"
    data = _get_json(url)
    if not data:
        return None
    cids = data.get("IdentifierList", {}).get("CID", [])
    return cids[0] if cids else None


def get_synonyms(cid):
    """Raw synonym list for a CID (PubChem aggregates registry numbers, trade names,
    and cross-database IDs -- including EPA's own DTXSID -- into this one list)."""
    url = f"{PUG_BASE}/compound/cid/{cid}/synonyms/JSON"
    data = _get_json(url)
    if not data:
        return []
    out = []
    for info in data.get("InformationList", {}).get("Information", []):
        out.extend(info.get("Synonym", []))
    return out


def _extract_cas(synonyms):
    for syn in synonyms:
        parts = syn.split("-")
        if len(parts) == 3 and all(p.isdigit() for p in parts) and 5 <= len(syn) <= 12:
            return syn
    return None


def _extract_dtxsid(synonyms):
    """EPA's DSSTox Substance ID (the identifier the CompTOX Chemicals Dashboard keys
    on), when PubChem's synonym list happens to include it. PubChem cross-references
    DSSTox for most well-studied substances, which lets us link out to CompTOX without
    needing the CTX API's own key (that API requires emailing ccte_api@epa.gov for one;
    see sources/README or app CompTOX notes -- this synonym cross-reference sidesteps
    that entirely, at the cost of not resolving for obscure/unlisted compounds)."""
    for syn in synonyms:
        if re.fullmatch(r"DTXSID\d+", syn.strip(), re.IGNORECASE):
            return syn.strip().upper()
    return None


def get_cas(cid):
    """Best-effort CAS registry number lookup via synonyms (first CAS-shaped synonym)."""
    return _extract_cas(get_synonyms(cid))


def _walk_sections(section, heading):
    if section.get("TOCHeading") == heading:
        return section
    for sub in section.get("Section", []):
        found = _walk_sections(sub, heading)
        if found:
            return found
    return None


def get_ghs_hazards(cid):
    """Return a list of GHS hazard statement strings for a CID, e.g. 'H317: May cause
    an allergic skin reaction'. Returns [] if PubChem has no GHS section for this CID."""
    url = f"{PUG_VIEW_BASE}/data/compound/{cid}/JSON?heading=GHS+Classification"
    data = _get_json(url)
    if not data:
        return []
    record = data.get("Record", {})
    section = _walk_sections(record, "GHS Classification")
    if not section:
        return []
    statements = []
    for info in section.get("Information", []):
        if info.get("Name") == "GHS Hazard Statements":
            for markup in info.get("Value", {}).get("StringWithMarkup", []):
                text = markup.get("String", "")
                if text and text not in statements:
                    statements.append(text)
    return statements


def lookup(name):
    """One-shot: name -> {cid, cas, pubchem_url, dtxsid, comptox_url, ghs_hazards} or
    None if not found. dtxsid/comptox_url are None when PubChem's synonym list doesn't
    happen to carry EPA's DSSTox ID for this substance (common for less-studied ones)."""
    cid = get_cid(name)
    if not cid:
        return None
    synonyms = get_synonyms(cid)
    dtxsid = _extract_dtxsid(synonyms)
    return {
        "cid": cid,
        "cas": _extract_cas(synonyms),
        "pubchem_url": f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}",
        "dtxsid": dtxsid,
        "comptox_url": f"https://comptox.epa.gov/dashboard/chemical/details/{dtxsid}" if dtxsid else None,
        "ghs_hazards": get_ghs_hazards(cid),
    }


if __name__ == "__main__":
    import sys
    name = " ".join(sys.argv[1:]) or "formaldehyde"
    result = lookup(name)
    print(json.dumps(result, indent=2))
