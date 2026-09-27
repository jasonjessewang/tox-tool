"""
Enriches data/hazard_database.json with LIVE data pulled from public sources:

  - PubMed (NIH/NLM E-utilities): real peer-reviewed citations (title, journal, year,
    DOI, PMID), preferring systematic reviews/meta-analyses. PubMed indexes Nature,
    Elsevier/ScienceDirect, and Cochrane Database of Systematic Reviews articles, so
    this one open source covers all three without needing separate paywalled API access.
  - PubChem (NIH/NLM): resolves each substance to a PubChem CID + CAS number and pulls
    its official GHS hazard classification (aggregated from OSHA/UN sources), plus --
    when PubChem's synonym list happens to carry it -- EPA's own DTXSID, so we can link
    out to the CompTOX Chemicals Dashboard (comptox.epa.gov) without needing an EPA CTX
    API key (that API requires emailing ccte_api@epa.gov for one; this sidesteps it by
    reading the cross-reference PubChem already publishes).

Each substance entry gets:
  - references: [{pmid, title, journal, year, doi, url}, ...]  (real, re-checkable)
  - regulatory: {cid, cas, pubchem_url, dtxsid, comptox_url, ghs_hazards: [...]} or null
    if not a single resolvable compound (e.g. "added sugar", "indoor mold" are
    categories/conditions, not chemicals with a GHS entry). dtxsid/comptox_url are null
    within a non-null regulatory block when PubChem doesn't carry that cross-reference.
  - last_synced: ISO date this entry was last refreshed from the network

Run: python3 -m sources.sync_db [--only <substance_id>] [--stale-only DAYS] [--dry-run]

Safe to re-run any time to refresh citations/hazard data — this is the "pulls/updates
from latest scientific sources" mechanism for the app. It intentionally does NOT touch
summary/mitigation_tips/concern_level, which are curated editorial content, not synced data.

Network calls (both PubMed and PubChem clients) retry transient failures (503/429/
timeouts) with backoff, so this is safe to run unattended -- e.g. from a weekly cron job
or launchd/Task Scheduler entry the user sets up themselves (this script doesn't install
one itself: adding a standing scheduled job is a system change outside this project's
scope to make unilaterally). `--stale-only 30` makes a periodic run cheap by skipping
anything synced in the last 30 days instead of re-fetching all ~36 substances every time.
A substance whose lookups both fail this run keeps its old `last_synced` date rather than
being incorrectly stamped "fresh" -- so it's picked up again on the next periodic run
instead of silently going stale forever.
"""
import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sources import pubchem_client, pubmed_client  # noqa: E402

DB_PATH = Path(__file__).parent.parent / "data" / "hazard_database.json"

# GHS statements from PubChem often repeat the same H-code multiple times (once per
# contributing data source, sometimes with a "(NN%)" prevalence annotation). We dedupe
# by H-code and drop the source is IMPORTANT: these codes describe the PURE/CONCENTRATED
# substance as handled industrially, not a diluted trace amount in a consumer product.
_HCODE_RE = re.compile(r"^(H\d{3}[a-z]?)\b")


def _dedupe_ghs(statements, cap=8):
    seen = {}
    order = []
    for s in statements:
        m = _HCODE_RE.match(s)
        code = m.group(1) if m else s
        # strip a leading "(NN%)" style prevalence annotation for a cleaner display string
        cleaned = re.sub(r"^(H\d{3}[a-z]?)\s*\(\d+(\.\d+)?%\)\s*:", r"\1:", s)
        if code not in seen:
            seen[code] = cleaned
            order.append(code)
    return [seen[c] for c in order][:cap]


def citations_for(entry):
    """The references an entry should carry.

    `curated_pmids` are hand-picked and always come first (their metadata is fetched live). `pubmed_anchors` are the words a
    search result's title must contain to be used at all -- without them PubMed's relevance ranking fills the list with papers that
    merely mention the query words (a green-spaces study for a lead query). An entry with curated PMIDs and no anchors is not
    topped up from the search: a short list of the right papers beats a longer one that is padded. A curated list that could not
    be fully resolved raises, so a network hiccup never replaces good references with fewer of them."""
    curated = [str(p) for p in entry.get("curated_pmids") or []]
    anchors = entry.get("pubmed_anchors") or None
    n = len(curated) if curated and not anchors else max(3, len(curated))
    citations = pubmed_client.top_citations(entry.get("pubmed_query", ""), n=n, anchors=anchors, curated=curated)
    if curated and len([c for c in citations if c["pmid"] in curated]) < len(curated):
        missing = sorted(set(curated) - {c["pmid"] for c in citations})
        raise RuntimeError(f"curated PMIDs not resolved: {', '.join(missing)}")
    return citations


def sync_substance(entry, dry_run=False):
    changed = {}
    any_lookup_attempted = False
    any_lookup_succeeded = False

    if entry.get("pubmed_query") or entry.get("curated_pmids"):
        any_lookup_attempted = True
        try:
            changed["references"] = citations_for(entry)
            any_lookup_succeeded = True
        except Exception as e:
            print(f"  [warn] PubMed lookup failed for {entry['id']}: {e}")

    if entry.get("pubchem_name"):
        any_lookup_attempted = True
        try:
            hit = pubchem_client.lookup(entry["pubchem_name"])
            if hit:
                changed["regulatory"] = {
                    "cid": hit["cid"],
                    "cas": hit["cas"],
                    "pubchem_url": hit["pubchem_url"],
                    "dtxsid": hit["dtxsid"],
                    "comptox_url": hit["comptox_url"],
                    "ghs_hazards": _dedupe_ghs(hit["ghs_hazards"]),
                }
                any_lookup_succeeded = True
            else:
                print(f"  [warn] PubChem couldn't resolve '{entry['pubchem_name']}' for {entry['id']}")
        except Exception as e:
            print(f"  [warn] PubChem lookup failed for {entry['id']}: {e}")
    else:
        changed["regulatory"] = None
        any_lookup_succeeded = True  # "no regulatory data" is the correct, stable state for a category entry

    if not dry_run:
        entry.update(changed)
        # Only stamp today's date if we actually learned something (or correctly confirmed
        # "no regulatory data" for a category entry) -- a substance where every network
        # call failed keeps its old last_synced so --stale-only picks it up again next
        # time, instead of it looking freshly synced while carrying stale data.
        if any_lookup_succeeded or not any_lookup_attempted:
            entry["last_synced"] = dt.date.today().isoformat()

    return changed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", help="Only sync this substance id")
    parser.add_argument("--stale-only", type=int, metavar="DAYS", help="Skip substances last synced within DAYS days -- makes a periodic/cron run cheap")
    parser.add_argument("--dry-run", action="store_true", help="Fetch but don't write to disk")
    args = parser.parse_args()

    with open(DB_PATH) as f:
        db = json.load(f)

    targets = [s for s in db["substances"] if not args.only or s["id"] == args.only]
    if not targets:
        print(f"No substance matched id={args.only!r}")
        return 1

    if args.stale_only is not None:
        cutoff = dt.date.today() - dt.timedelta(days=args.stale_only)
        before = len(targets)
        targets = [
            s for s in targets
            if not s.get("last_synced") or dt.date.fromisoformat(s["last_synced"]) <= cutoff
        ]
        print(f"--stale-only {args.stale_only}: {len(targets)}/{before} substance(s) are due (last_synced <= {cutoff.isoformat()})")
        if not targets:
            print("Nothing due -- exiting.")
            return 0

    print(f"Syncing {len(targets)} substance(s) from PubMed + PubChem...\n")
    for entry in targets:
        print(f"- {entry['id']} ({entry['name']})")
        result = sync_substance(entry, dry_run=args.dry_run)
        n_refs = len(result.get("references", []))
        reg = result.get("regulatory") or {}
        has_ghs = bool(reg.get("ghs_hazards"))
        has_dtxsid = bool(reg.get("dtxsid"))
        print(f"    references: {n_refs}   regulatory/GHS: {'yes' if has_ghs else 'no'}   CompTOX: {'yes' if has_dtxsid else 'no'}")

    if not args.dry_run:
        db["_meta"]["last_synced"] = dt.date.today().isoformat()
        with open(DB_PATH, "w") as f:
            json.dump(db, f, indent=2)
            f.write("\n")
        print(f"\nWrote updates to {DB_PATH}")
    else:
        print("\n--dry-run: nothing written")

    return 0


if __name__ == "__main__":
    sys.exit(main())
