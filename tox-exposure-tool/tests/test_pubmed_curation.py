"""Curated references and the relevance check on searched ones. No network: the PubMed client's two calls are stubbed."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from sources import pubmed_client, sync_db  # noqa: E402


def cite(pmid, title):
    return {"pmid": str(pmid), "title": title, "journal": "J", "year": "2024", "doi": None, "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"}


CATALOG = {
    "1": cite(1, "Prevention of childhood lead toxicity"),
    "2": cite(2, "Lead poisoning in children"),
    "3": cite(3, "Green spaces and neurodevelopmental outcomes in European children"),
    "4": cite(4, "Neurodevelopmental outcomes in children living near hazardous waste sites"),
    "5": cite(5, "Household interventions for secondary prevention of domestic lead exposure in children"),
}


@pytest.fixture(autouse=True)
def stub(monkeypatch):
    monkeypatch.setattr(pubmed_client, "fetch_summaries", lambda pmids: [CATALOG[str(p)] for p in pmids if str(p) in CATALOG])
    monkeypatch.setattr(pubmed_client, "search_pmids", lambda q, retmax=5, prefer_reviews=True: ["3", "4", "2", "5"][:retmax])


def test_title_matches_uses_whole_words_and_ignores_case():
    assert pubmed_client.title_matches("Lead poisoning in children", ["lead"])
    assert pubmed_client.title_matches("LEAD exposure", ["lead"])
    assert not pubmed_client.title_matches("Leadership in health care", ["lead"])
    assert not pubmed_client.title_matches("Green spaces and children", ["lead", "Pb"])
    assert pubmed_client.title_matches("Blood Pb levels", ["lead", "Pb"])
    assert pubmed_client.title_matches("anything at all", None)
    assert pubmed_client.title_matches("anything at all", [])


def test_a_search_without_anchors_is_what_it_always_was():
    assert [c["pmid"] for c in pubmed_client.top_citations("lead children", n=3)] == ["3", "4", "2"]


def test_anchors_drop_papers_that_only_mention_the_query_words():
    got = pubmed_client.top_citations("lead children", n=3, anchors=["lead"])
    assert [c["pmid"] for c in got] == ["2", "5"]  # the green-spaces and waste-site papers are gone; fewer, but the right ones


def test_curated_papers_come_first_in_the_order_given_and_the_search_only_tops_up():
    got = pubmed_client.top_citations("lead children", n=3, anchors=["lead"], curated=["5", "1"])
    assert [c["pmid"] for c in got] == ["5", "1", "2"]


def test_a_curated_paper_is_not_listed_twice_when_the_search_finds_it_too():
    got = pubmed_client.top_citations("lead children", n=4, anchors=["lead"], curated=["2"])
    assert [c["pmid"] for c in got] == ["2", "5"]


def test_citations_for_an_entry_with_curated_papers_and_no_anchors_is_not_padded_from_the_search():
    entry = {"id": "lead_exposure", "pubmed_query": "lead children", "curated_pmids": ["1", "2"]}
    assert [c["pmid"] for c in sync_db.citations_for(entry)] == ["1", "2"]


def test_citations_for_tops_up_to_three_when_anchors_make_the_search_trustworthy():
    entry = {"id": "lead_exposure", "pubmed_query": "lead children", "curated_pmids": ["1"], "pubmed_anchors": ["lead"]}
    assert [c["pmid"] for c in sync_db.citations_for(entry)] == ["1", "2", "5"]


def test_a_curated_list_that_cannot_be_fully_resolved_raises_instead_of_replacing_good_references_with_fewer():
    entry = {"id": "lead_exposure", "pubmed_query": "", "curated_pmids": ["1", "999999"]}
    with pytest.raises(RuntimeError, match="999999"):
        sync_db.citations_for(entry)


def test_an_entry_with_neither_curation_nor_anchors_behaves_as_before():
    assert [c["pmid"] for c in sync_db.citations_for({"id": "x", "pubmed_query": "lead children"})] == ["3", "4", "2"]


def test_fetch_summaries_returns_papers_in_the_order_asked_for(monkeypatch):
    monkeypatch.undo()  # the real function, with the network call stubbed
    payload = {"result": {"uids": ["3", "1", "2"], "1": {"title": "One.", "source": "J", "pubdate": "2020 Jan"}, "2": {"title": "Two.", "source": "J", "pubdate": "2021"}, "3": {"title": "Three.", "source": "J", "pubdate": "2022"}}}
    monkeypatch.setattr(pubmed_client, "_get", lambda url, params: payload)
    assert [c["pmid"] for c in pubmed_client.fetch_summaries(["1", "2", "3"])] == ["1", "2", "3"]
    assert [c["pmid"] for c in pubmed_client.fetch_summaries(["3", "2", "1"])] == ["3", "2", "1"]
    assert pubmed_client.fetch_summaries(["1"])[0]["title"] == "One"
