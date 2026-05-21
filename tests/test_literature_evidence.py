from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from q_ai_drug.config import AppConfig, PathsConfig, TargetConfig
from q_ai_drug.data.literature import collect_target_literature_evidence, parse_pubmed_xml


PUBMED_XML = """<?xml version="1.0" encoding="UTF-8"?>
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>12345</PMID>
      <Article>
        <Journal>
          <JournalIssue>
            <PubDate><Year>2024</Year><Month>Jan</Month></PubDate>
          </JournalIssue>
          <Title>Journal of Oncology Context</Title>
        </Journal>
        <ArticleTitle>EGFR inhibitor resistance in lung cancer</ArticleTitle>
        <Abstract>
          <AbstractText>Patients with EGFR mutant tumors can develop resistance after inhibitor treatment.</AbstractText>
        </Abstract>
        <AuthorList>
          <Author><LastName>Smith</LastName><Initials>A</Initials></Author>
        </AuthorList>
        <PublicationTypeList>
          <PublicationType>Clinical Trial</PublicationType>
          <PublicationType>Journal Article</PublicationType>
        </PublicationTypeList>
      </Article>
    </MedlineCitation>
    <PubmedData>
      <ArticleIdList>
        <ArticleId IdType="pubmed">12345</ArticleId>
        <ArticleId IdType="doi">10.1000/example</ArticleId>
      </ArticleIdList>
    </PubmedData>
  </PubmedArticle>
</PubmedArticleSet>
"""


class FakeResponse:
    def __init__(self, *, payload: dict[str, Any] | None = None, text: str = ""):
        self._payload = payload or {}
        self.text = text

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, Any]:
        return self._payload


class FakeSession:
    def get(self, url: str, params: dict[str, Any], timeout: int) -> FakeResponse:
        if url.endswith("esearch.fcgi"):
            return FakeResponse(payload={"esearchresult": {"idlist": ["12345"]}})
        if url.endswith("efetch.fcgi"):
            return FakeResponse(text=PUBMED_XML)
        raise AssertionError(f"unexpected URL {url}")


def _config(tmp_path: Path) -> AppConfig:
    return AppConfig(
        project_name="test",
        primary_targets={
            "EGFR": TargetConfig(
                target_id="EGFR",
                gene="EGFR",
                uniprot_id="P00533",
                cancer_types=["NSCLC"],
                reference_drugs=["erlotinib"],
            )
        },
        paths=PathsConfig(processed_dir=tmp_path / "processed"),
    )


def test_parse_pubmed_xml_extracts_honest_context_fields() -> None:
    rows = parse_pubmed_xml(PUBMED_XML)
    assert rows[0]["pmid"] == "12345"
    assert rows[0]["doi"] == "10.1000/example"
    assert rows[0]["publication_year"] == 2024
    assert "Clinical Trial" in rows[0]["publication_types"]


def test_collect_target_literature_evidence_writes_pubmed_artifacts(tmp_path: Path) -> None:
    summary = collect_target_literature_evidence(
        _config(tmp_path),
        target_ids=["EGFR"],
        out_dir=tmp_path / "literature",
        max_records_per_query=1,
        include_reference_drugs=False,
        session=FakeSession(),
        sleep_s=0,
    )

    evidence_path = Path(summary["evidence"])
    summary_path = Path(summary["summary"])
    manifest_path = Path(summary["manifest"])
    assert evidence_path.exists()
    assert summary_path.exists()
    assert manifest_path.exists()

    evidence = pd.read_csv(evidence_path)
    target_summary = pd.read_csv(summary_path)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    assert summary["records"] == 1
    assert evidence.loc[0, "source_database"] == "PubMed"
    assert evidence.loc[0, "evidence_tier"] == "human_clinical_context"
    assert "not validate" in evidence.loc[0, "claim_boundary"]
    assert int(target_summary.loc[0, "clinical_trial_records"]) == 1
    assert manifest["unique_pmids"] == 1
