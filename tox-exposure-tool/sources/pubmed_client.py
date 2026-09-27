"""
Thin client for NCBI PubMed E-utilities (no API key required for low-volume use,
NCBI asks for <=3 requests/sec without a key: https://www.ncbi.nlm.nih.gov/books/NBK25497/).

Used to pull REAL citation metadata (title, journal, year, DOI, PMID) for the hazard
database's references, instead of hand-written/hallucinated citations. PubMed indexes
article metadata + abstracts from Nature, Elsevier/ScienceDirect journals, and the
Cochrane Database of Systematic Reviews, so this one source covers all three without
needing separate (paywalled) publisher API access.

We only ever store: title, journal, year, PMID, DOI, and a PubMed URL. We do not store
or reproduce full article text or abstracts verbatim beyond what's needed to identify
the source, respecting publisher copyright.
"""
import json
import re
import time
import urllib.request
import urllib.parse
import urllib.error

ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
ESUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"

USER_AGENT = "exposure-awareness-tool/0.1 (educational, local single-user; contact: n/a)"
MIN_REQUEST_INTERVAL = 0.35  # stay under NCBI's 3 req/sec unauthenticated limit
_last_request_time = [0.0]

# Same reasoning as pubchem_client's retry: NCBI's own docs note it may throttle or
# briefly fail requests under load, and this makes an unattended/periodic run resilient
# to that instead of needing a human to notice a failure and re-run it.
RETRY_STATUS = {503, 429}
MAX_RETRIES = 4


def _get(url, params):
    qs = urllib.parse.urlencode(params)
    req = urllib.request.Request(f"{url}?{qs}", headers={"User-Agent": USER_AGENT})
    for attempt in range(MAX_RETRIES + 1):
        _throttle()
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in RETRY_STATUS and attempt < MAX_RETRIES:
                time.sleep(2**attempt)
                continue
            raise
        except (urllib.error.URLError, TimeoutError):
            if attempt < MAX_RETRIES:
                time.sleep(2**attempt)
                continue
            raise


def _throttle():
    elapsed = time.time() - _last_request_time[0]
    if elapsed < MIN_REQUEST_INTERVAL:
        time.sleep(MIN_REQUEST_INTERVAL - elapsed)
    _last_request_time[0] = time.time()


def search_pmids(query, retmax=5, prefer_reviews=True):
    """Return a list of PMIDs for a query, preferring systematic reviews/meta-analyses
    when available (falls back to a plain relevance search if that yields too few)."""
    if prefer_reviews:
        boosted = f"({query}) AND (review[pt] OR systematic review[pt] OR meta-analysis[pt])"
        result = _get(ESEARCH_URL, {
            "db": "pubmed", "term": boosted, "retmode": "json",
            "retmax": retmax, "sort": "relevance",
        })
        ids = result.get("esearchresult", {}).get("idlist", [])
        if len(ids) >= min(2, retmax):
            return ids
    result = _get(ESEARCH_URL, {
        "db": "pubmed", "term": query, "retmode": "json",
        "retmax": retmax, "sort": "relevance",
    })
    return result.get("esearchresult", {}).get("idlist", [])


def fetch_summaries(pmids):
    """Given PMIDs, return citation dicts: pmid, title, journal, year, doi, url."""
    if not pmids:
        return []
    result = _get(ESUMMARY_URL, {
        "db": "pubmed", "id": ",".join(pmids), "retmode": "json",
    })
    by_pmid = {}
    res = result.get("result", {})
    for pmid in res.get("uids", []):
        item = res.get(pmid, {})
        doi = None
        for aid in item.get("articleids", []):
            if aid.get("idtype") == "doi":
                doi = aid.get("value")
                break
        pubdate = item.get("pubdate", "")
        year = "".join(ch for ch in pubdate[:4] if ch.isdigit()) or pubdate
        by_pmid[pmid] = {
            "pmid": pmid,
            "title": item.get("title", "").rstrip("."),
            "journal": item.get("source", item.get("fulljournalname", "")),
            "year": year,
            "doi": doi,
            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
        }
    # In the order asked for: esummary does not promise one, and a search's relevance order (or a curated list's order) matters.
    return [by_pmid[str(p)] for p in pmids if str(p) in by_pmid]


def title_matches(title, anchors):
    """True when the title names at least one anchor term as a whole word (case-insensitive).

    With no anchors nothing is filtered. This is the relevance check the search itself lacks: PubMed's ranking will happily
    return a paper about green spaces and children's neurodevelopment for a query about lead, because the query words appear
    somewhere in it. An anchor is the thing the paper must actually be about ("lead", "radon", "humidity")."""
    if not anchors:
        return True
    return any(re.search(r"(?<!\w)" + re.escape(a) + r"(?!\w)", title, re.IGNORECASE) for a in anchors)


def curated_citations(pmids):
    """Live metadata for hand-picked PMIDs, in the order given. A PMID that cannot be resolved is simply missing from the result
    (the caller decides whether that is acceptable)."""
    return fetch_summaries([str(p) for p in pmids])


def top_citations(query, n=3, prefer_reviews=True, anchors=None, curated=None):
    """Search + summarize in one call.

    `curated` PMIDs come first, with their metadata fetched live (the identifiers are chosen by a person reading a PubMed
    search, never typed from memory). If fewer than `n` are curated, the search tops the list up -- and when `anchors` are given,
    only with papers whose title names one of them."""
    out = curated_citations(curated) if curated else []
    seen = {c["pmid"] for c in out}
    if len(out) < n and query:
        pool = max(n * 4, 12) if anchors else n
        for c in fetch_summaries(search_pmids(query, retmax=pool, prefer_reviews=prefer_reviews)):
            if c["pmid"] in seen or not title_matches(c["title"], anchors):
                continue
            out.append(c)
            seen.add(c["pmid"])
            if len(out) >= n:
                break
    return out


if __name__ == "__main__":
    import sys
    q = " ".join(sys.argv[1:]) or "parabens endocrine disruption"
    for c in top_citations(q):
        print(f"[{c['year']}] {c['title']} — {c['journal']} (PMID {c['pmid']}, DOI {c['doi']})")
        print(f"  {c['url']}")
