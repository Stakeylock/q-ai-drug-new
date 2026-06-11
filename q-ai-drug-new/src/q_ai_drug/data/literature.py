from __future__ import annotations

import json
import os
import re
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import pandas as pd
import requests

from q_ai_drug.config import AppConfig, TargetConfig


NCBI_EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
CLAIM_BOUNDARY = (
    "Literature records are automated context evidence only. They do not validate "
    "generated candidates, binding, activity, safety, efficacy, or therapeutic use."
)

LITERATURE_COLUMNS = [
    "target_id",
    "gene",
    "query_role",
    "reference_drug",
    "cancer_context",
    "query",
    "source_database",
    "pmid",
    "doi",
    "title",
    "abstract",
    "journal",
    "publication_year",
    "publication_date",
    "publication_types",
    "authors",
    "evidence_tags",
    "evidence_tier",
    "source_url",
    "claim_boundary",
]


SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "q-ai-drug/0.1 literature evidence ingestion"})


@dataclass(frozen=True)
class LiteratureQuery:
    target_id: str
    gene: str
    query_role: str
    query: str
    cancer_context: str
    reference_drug: str | None = None


def _squash(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def _node_text(node: ET.Element | None) -> str:
    if node is None:
        return ""
    return _squash("".join(node.itertext()))


def _first_text(root: ET.Element, path: str) -> str:
    return _node_text(root.find(path))


def _first_year(*values: str | None) -> int | None:
    for value in values:
        match = re.search(r"(19|20)\d{2}", value or "")
        if match:
            return int(match.group(0))
    return None


def _base_params(email: str | None = None, api_key: str | None = None) -> dict[str, str]:
    params = {"tool": "q_ai_drug"}
    email = email or os.getenv("NCBI_EMAIL")
    api_key = api_key or os.getenv("NCBI_API_KEY")
    if email:
        params["email"] = email
    if api_key:
        params["api_key"] = api_key
    return params


def _get_json(
    session: requests.Session,
    endpoint: str,
    params: dict[str, Any],
    *,
    retries: int = 3,
    sleep_s: float = 0.5,
) -> dict[str, Any]:
    url = f"{NCBI_EUTILS_BASE}/{endpoint}"
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            response = session.get(url, params=params, timeout=60)
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            last_error = exc
            if attempt + 1 < retries:
                time.sleep(sleep_s)
    raise RuntimeError(f"PubMed JSON request failed for {endpoint}: {last_error}")


def _get_text(
    session: requests.Session,
    endpoint: str,
    params: dict[str, Any],
    *,
    retries: int = 3,
    sleep_s: float = 0.5,
) -> str:
    url = f"{NCBI_EUTILS_BASE}/{endpoint}"
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            response = session.get(url, params=params, timeout=90)
            response.raise_for_status()
            return response.text
        except Exception as exc:
            last_error = exc
            if attempt + 1 < retries:
                time.sleep(sleep_s)
    raise RuntimeError(f"PubMed text request failed for {endpoint}: {last_error}")


def search_pubmed_ids(
    query: str,
    *,
    max_records: int = 20,
    session: requests.Session | None = None,
    email: str | None = None,
    api_key: str | None = None,
) -> list[str]:
    """Return PubMed IDs for a query using NCBI ESearch."""

    session = session or SESSION
    params: dict[str, Any] = {
        **_base_params(email=email, api_key=api_key),
        "db": "pubmed",
        "term": query,
        "retmode": "json",
        "retmax": max(0, int(max_records)),
        "sort": "relevance",
    }
    payload = _get_json(session, "esearch.fcgi", params)
    ids = payload.get("esearchresult", {}).get("idlist", [])
    return [str(pmid) for pmid in ids if str(pmid).strip()]


def parse_pubmed_xml(xml_text: str) -> list[dict[str, Any]]:
    """Parse NCBI PubMed XML into a compact evidence-record shape."""

    if not xml_text.strip():
        return []
    root = ET.fromstring(xml_text)
    records: list[dict[str, Any]] = []
    for article_node in root.findall(".//PubmedArticle"):
        article = article_node.find("./MedlineCitation/Article")
        if article is None:
            continue
        pmid = _first_text(article_node, "./MedlineCitation/PMID")
        pub_date = article.find("./Journal/JournalIssue/PubDate")
        medline_date = _first_text(pub_date, "./MedlineDate") if pub_date is not None else ""
        year = _first_year(
            _first_text(article, "./ArticleDate/Year"),
            _first_text(pub_date, "./Year") if pub_date is not None else "",
            medline_date,
        )
        month = _first_text(pub_date, "./Month") if pub_date is not None else ""
        day = _first_text(pub_date, "./Day") if pub_date is not None else ""
        publication_date = " ".join(part for part in [str(year or ""), month, day] if part).strip()

        abstract_parts = []
        for abstract_node in article.findall("./Abstract/AbstractText"):
            label = abstract_node.attrib.get("Label")
            text = _node_text(abstract_node)
            if not text:
                continue
            abstract_parts.append(f"{label}: {text}" if label else text)

        ids = {
            (node.attrib.get("IdType") or "").lower(): _node_text(node)
            for node in article_node.findall("./PubmedData/ArticleIdList/ArticleId")
        }
        pub_types = [_node_text(node) for node in article.findall("./PublicationTypeList/PublicationType")]
        authors = []
        for author in article.findall("./AuthorList/Author"):
            collective = _first_text(author, "./CollectiveName")
            if collective:
                authors.append(collective)
                continue
            last = _first_text(author, "./LastName")
            initials = _first_text(author, "./Initials")
            name = " ".join(part for part in [last, initials] if part)
            if name:
                authors.append(name)

        records.append(
            {
                "pmid": pmid,
                "doi": ids.get("doi"),
                "title": _node_text(article.find("./ArticleTitle")),
                "abstract": _squash(" ".join(abstract_parts)),
                "journal": _first_text(article, "./Journal/Title") or _first_text(article, "./Journal/ISOAbbreviation"),
                "publication_year": year,
                "publication_date": publication_date,
                "publication_types": "; ".join(pub_types),
                "authors": "; ".join(authors[:12]),
                "source_url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else None,
            }
        )
    return records


def fetch_pubmed_articles(
    pmids: Iterable[str],
    *,
    session: requests.Session | None = None,
    email: str | None = None,
    api_key: str | None = None,
) -> list[dict[str, Any]]:
    """Fetch article metadata and abstracts for PubMed IDs using NCBI EFetch."""

    pmid_list = [str(pmid) for pmid in pmids if str(pmid).strip()]
    if not pmid_list:
        return []
    session = session or SESSION
    params = {
        **_base_params(email=email, api_key=api_key),
        "db": "pubmed",
        "id": ",".join(pmid_list),
        "retmode": "xml",
    }
    return parse_pubmed_xml(_get_text(session, "efetch.fcgi", params))


def classify_literature_record(record: dict[str, Any]) -> tuple[list[str], str]:
    text = " ".join(
        str(record.get(key) or "")
        for key in ["title", "abstract", "publication_types"]
    ).lower()
    tags: list[str] = []
    keyword_map = {
        "clinical_trial": ["clinical trial", "phase i", "phase ii", "phase iii", "randomized", "patients"],
        "review": ["review", "meta-analysis", "systematic review"],
        "preclinical": ["xenograft", "cell line", "in vitro", "in vivo", "mouse", "murine"],
        "resistance": ["resistance", "resistant", "mutation", "mutant"],
        "biomarker": ["biomarker", "predictive marker", "expression", "amplification"],
        "structure": ["crystal structure", "structure-based", "binding pocket", "docking"],
        "inhibitor": ["inhibitor", "inhibition", "kinase inhibitor", "parp inhibitor"],
        "toxicity": ["toxicity", "adverse event", "safety"],
    }
    for tag, keywords in keyword_map.items():
        if any(keyword in text for keyword in keywords):
            tags.append(tag)
    if "clinical_trial" in tags:
        tier = "human_clinical_context"
    elif "preclinical" in tags:
        tier = "preclinical_or_mechanistic_context"
    elif "review" in tags:
        tier = "review_or_background_context"
    else:
        tier = "literature_context_only"
    return tags or ["unclassified_context"], tier


def _quoted_terms(values: Iterable[str]) -> str:
    terms = []
    for value in values:
        clean = str(value).strip().replace('"', "")
        if clean:
            terms.append(f'"{clean}"[Title/Abstract]')
    return " OR ".join(terms)


def build_target_literature_queries(
    targets: dict[str, TargetConfig],
    *,
    target_ids: Iterable[str] | None = None,
    include_reference_drugs: bool = True,
    max_reference_drugs_per_target: int = 3,
) -> list[LiteratureQuery]:
    """Build conservative target and reference-drug PubMed queries."""

    requested = {str(target_id) for target_id in target_ids} if target_ids else set(targets)
    unknown = requested - set(targets)
    if unknown:
        raise KeyError(f"Unknown target ids for literature search: {', '.join(sorted(unknown))}")

    queries: list[LiteratureQuery] = []
    oncology_terms = [
        "cancer",
        "oncology",
        "tumor",
        "tumour",
        "carcinoma",
        "neoplasm",
    ]
    evidence_terms = [
        "inhibitor",
        "therapeutic target",
        "resistance",
        "biomarker",
        "clinical trial",
        "preclinical",
    ]
    for target_id in sorted(requested):
        target = targets[target_id]
        gene_terms = _quoted_terms([target.gene, target_id, target.uniprot_id])
        cancer_contexts = list(target.cancer_types or [])[:4]
        cancer_terms = _quoted_terms([*oncology_terms, *cancer_contexts])
        evidence = _quoted_terms(evidence_terms)
        context = "; ".join(cancer_contexts) if cancer_contexts else "oncology"
        query = f"({gene_terms}) AND ({cancer_terms}) AND ({evidence})"
        queries.append(
            LiteratureQuery(
                target_id=target_id,
                gene=target.gene,
                query_role="target_oncology_context",
                query=query,
                cancer_context=context,
            )
        )
        if include_reference_drugs:
            for drug in target.reference_drugs[:max(0, int(max_reference_drugs_per_target))]:
                drug_terms = _quoted_terms([drug])
                drug_query = f"({drug_terms}) AND ({gene_terms}) AND ({cancer_terms})"
                queries.append(
                    LiteratureQuery(
                        target_id=target_id,
                        gene=target.gene,
                        query_role="reference_drug_context",
                        query=drug_query,
                        cancer_context=context,
                        reference_drug=drug,
                    )
                )
    return queries


def _row_from_record(query: LiteratureQuery, record: dict[str, Any]) -> dict[str, Any]:
    tags, tier = classify_literature_record(record)
    return {
        "target_id": query.target_id,
        "gene": query.gene,
        "query_role": query.query_role,
        "reference_drug": query.reference_drug,
        "cancer_context": query.cancer_context,
        "query": query.query,
        "source_database": "PubMed",
        "pmid": record.get("pmid"),
        "doi": record.get("doi"),
        "title": record.get("title"),
        "abstract": record.get("abstract"),
        "journal": record.get("journal"),
        "publication_year": record.get("publication_year"),
        "publication_date": record.get("publication_date"),
        "publication_types": record.get("publication_types"),
        "authors": record.get("authors"),
        "evidence_tags": "; ".join(tags),
        "evidence_tier": tier,
        "source_url": record.get("source_url"),
        "claim_boundary": CLAIM_BOUNDARY,
    }


def summarize_literature_evidence(df: pd.DataFrame, targets: dict[str, TargetConfig]) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for target_id, target in targets.items():
        target_df = df[df["target_id"].astype(str).eq(str(target_id))] if not df.empty and "target_id" in df.columns else pd.DataFrame()
        years = pd.to_numeric(target_df.get("publication_year", pd.Series(dtype=float)), errors="coerce").dropna()
        tags = target_df.get("evidence_tags", pd.Series(dtype=str)).fillna("").astype(str) if not target_df.empty else pd.Series(dtype=str)
        roles = target_df.get("query_role", pd.Series(dtype=str)).fillna("").astype(str) if not target_df.empty else pd.Series(dtype=str)
        rows.append(
            {
                "target_id": target_id,
                "gene": target.gene,
                "records": int(len(target_df)),
                "unique_pmids": int(target_df["pmid"].nunique()) if not target_df.empty and "pmid" in target_df.columns else 0,
                "target_context_records": int(roles.eq("target_oncology_context").sum()) if not roles.empty else 0,
                "reference_drug_records": int(roles.eq("reference_drug_context").sum()) if not roles.empty else 0,
                "clinical_trial_records": int(tags.str.contains("clinical_trial", regex=False).sum()) if not tags.empty else 0,
                "review_records": int(tags.str.contains("review", regex=False).sum()) if not tags.empty else 0,
                "preclinical_records": int(tags.str.contains("preclinical", regex=False).sum()) if not tags.empty else 0,
                "latest_year": int(years.max()) if not years.empty else None,
                "evidence_status": "context_available" if len(target_df) else "missing",
                "claim_boundary": CLAIM_BOUNDARY,
            }
        )
    return pd.DataFrame(rows)


def collect_target_literature_evidence(
    config: AppConfig,
    *,
    target_ids: Iterable[str] | None = None,
    out_dir: str | Path | None = None,
    max_records_per_query: int = 20,
    include_reference_drugs: bool = True,
    max_reference_drugs_per_target: int = 3,
    session: requests.Session | None = None,
    sleep_s: float = 0.34,
    email: str | None = None,
    api_key: str | None = None,
) -> dict[str, Any]:
    """Fetch PubMed target-context literature and write auditable artifacts."""

    session = session or SESSION
    selected_targets = {
        target_id: config.primary_targets[target_id]
        for target_id in (list(target_ids) if target_ids else list(config.primary_targets))
    }
    queries = build_target_literature_queries(
        config.primary_targets,
        target_ids=selected_targets,
        include_reference_drugs=include_reference_drugs,
        max_reference_drugs_per_target=max_reference_drugs_per_target,
    )
    rows: list[dict[str, Any]] = []
    query_audit: list[dict[str, Any]] = []
    warnings: list[str] = []
    for query in queries:
        try:
            pmids = search_pubmed_ids(
                query.query,
                max_records=max_records_per_query,
                session=session,
                email=email,
                api_key=api_key,
            )
            records = fetch_pubmed_articles(pmids, session=session, email=email, api_key=api_key)
            rows.extend(_row_from_record(query, record) for record in records)
            query_audit.append(
                {
                    "target_id": query.target_id,
                    "query_role": query.query_role,
                    "reference_drug": query.reference_drug,
                    "query": query.query,
                    "pmids_returned": len(pmids),
                    "records_parsed": len(records),
                    "status": "ok",
                }
            )
        except Exception as exc:
            message = f"{query.target_id} {query.query_role} PubMed query failed: {exc}"
            warnings.append(message)
            query_audit.append(
                {
                    "target_id": query.target_id,
                    "query_role": query.query_role,
                    "reference_drug": query.reference_drug,
                    "query": query.query,
                    "pmids_returned": 0,
                    "records_parsed": 0,
                    "status": "failed",
                    "error": str(exc),
                }
            )
        if sleep_s > 0:
            time.sleep(sleep_s)

    out_path = Path(out_dir or config.paths.processed_dir / "literature")
    out_path.mkdir(parents=True, exist_ok=True)
    evidence = pd.DataFrame(rows, columns=LITERATURE_COLUMNS)
    if not evidence.empty:
        evidence = (
            evidence.sort_values(["target_id", "publication_year", "query_role"], ascending=[True, False, True], na_position="last")
            .drop_duplicates(["target_id", "pmid"], keep="first")
            .reset_index(drop=True)
        )
    summary = summarize_literature_evidence(evidence, selected_targets)
    query_df = pd.DataFrame(query_audit)

    evidence_path = out_path / "target_literature_evidence.csv"
    summary_path = out_path / "target_literature_summary.csv"
    query_path = out_path / "literature_query_audit.csv"
    manifest_path = out_path / "literature_evidence_manifest.json"
    evidence.to_csv(evidence_path, index=False)
    summary.to_csv(summary_path, index=False)
    query_df.to_csv(query_path, index=False)

    manifest = {
        "schema_version": "1.0",
        "source_database": "PubMed",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "target_ids": list(selected_targets),
        "query_count": len(queries),
        "record_count": int(len(evidence)),
        "unique_pmids": int(evidence["pmid"].nunique()) if not evidence.empty else 0,
        "max_records_per_query": int(max_records_per_query),
        "include_reference_drugs": bool(include_reference_drugs),
        "paths": {
            "evidence": evidence_path.as_posix(),
            "summary": summary_path.as_posix(),
            "query_audit": query_path.as_posix(),
        },
        "warnings": warnings,
        "claim_boundary": CLAIM_BOUNDARY,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2, default=str), encoding="utf-8")
    return {
        "records": int(len(evidence)),
        "unique_pmids": manifest["unique_pmids"],
        "queries": len(queries),
        "evidence": str(evidence_path),
        "summary": str(summary_path),
        "query_audit": str(query_path),
        "manifest": str(manifest_path),
        "warnings": warnings,
        "claim_boundary": CLAIM_BOUNDARY,
    }
