from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Iterable

from pydantic import BaseModel, Field

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_KNOWLEDGE_DIR = PROJECT_ROOT / "docs" / "tonejs-knowledge"


class ToneKnowledgeEntry(BaseModel):
    id: str
    title: str
    tags: list[str] = Field(default_factory=list)
    source: str = ""
    verified_with: str = ""
    body: str
    path: str


class ToneKnowledgeSearchResult(BaseModel):
    entry: ToneKnowledgeEntry
    score: int
    matched_terms: list[str] = Field(default_factory=list)


def _parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    raw_meta = parts[1]
    body = parts[2].strip()
    meta: dict[str, str] = {}
    for line in raw_meta.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        meta[key.strip()] = value.strip()
    return meta, body


def _parse_tags(raw: str) -> list[str]:
    cleaned = raw.strip()
    if cleaned.startswith("[") and cleaned.endswith("]"):
        cleaned = cleaned[1:-1]
    return [item.strip().strip('"\'') for item in cleaned.split(",") if item.strip()]


def load_tone_knowledge(directory: Path = DEFAULT_KNOWLEDGE_DIR) -> list[ToneKnowledgeEntry]:
    entries: list[ToneKnowledgeEntry] = []
    if not directory.exists():
        return entries
    for path in sorted(directory.glob("*.md")):
        meta, body = _parse_frontmatter(path.read_text(encoding="utf-8"))
        entry_id = meta.get("id") or path.stem
        entries.append(
            ToneKnowledgeEntry(
                id=entry_id,
                title=meta.get("title") or entry_id.replace("-", " ").title(),
                tags=_parse_tags(meta.get("tags", "")),
                source=meta.get("source", ""),
                verified_with=meta.get("verified_with", ""),
                body=body,
                path=str(path),
            )
        )
    return entries


@lru_cache(maxsize=1)
def get_tone_knowledge() -> tuple[ToneKnowledgeEntry, ...]:
    return tuple(load_tone_knowledge())


def _terms(query: str) -> list[str]:
    normalized = query.lower()
    # Keep Korean chunks, ASCII words, and common Tone symbol-ish words.
    raw_terms = [term for term in re.findall(r"[0-9a-zA-Z_.-]+|[가-힣]+", normalized) if len(term) >= 2]
    terms: list[str] = []
    for term in raw_terms:
        terms.append(term)
        if re.fullmatch(r"[가-힣]+", term):
            stripped = re.sub(r"(으로|에서|에게|처럼|하고|으로|로|을|를|은|는|이|가|에)$", "", term)
            if len(stripped) >= 2 and stripped != term:
                terms.append(stripped)
    return list(dict.fromkeys(terms))


def search_tone_knowledge(query: str, *, limit: int = 3, entries: Iterable[ToneKnowledgeEntry] | None = None) -> list[ToneKnowledgeSearchResult]:
    terms = _terms(query)
    if not terms:
        return []
    haystack_entries = list(entries) if entries is not None else list(get_tone_knowledge())
    results: list[ToneKnowledgeSearchResult] = []
    for entry in haystack_entries:
        weighted_text = " ".join([entry.id, entry.title, " ".join(entry.tags), entry.body]).lower()
        matched: list[str] = []
        score = 0
        for term in terms:
            count = weighted_text.count(term)
            if count:
                matched.append(term)
                score += count
                if term in entry.id.lower() or term in entry.tags:
                    score += 3
                if term in entry.title.lower():
                    score += 2
        if score:
            results.append(ToneKnowledgeSearchResult(entry=entry, score=score, matched_terms=matched))
    return sorted(results, key=lambda item: (-item.score, item.entry.id))[: max(1, limit)]


def build_tone_context(query: str, *, limit: int = 3, max_chars: int = 2400) -> str:
    results = search_tone_knowledge(query, limit=limit)
    chunks: list[str] = []
    remaining = max_chars
    for result in results:
        entry = result.entry
        header = f"[{entry.id}] {entry.title} ({entry.verified_with})\nsource: {entry.source}\n"
        body = entry.body.strip()
        chunk = header + body
        if len(chunk) > remaining:
            chunk = chunk[: max(0, remaining - 1)].rstrip() + "…"
        if chunk:
            chunks.append(chunk)
            remaining -= len(chunk) + 2
        if remaining <= 0:
            break
    return "\n\n".join(chunks)
