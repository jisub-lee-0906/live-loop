from pathlib import Path

from live_loop.tone_knowledge import build_tone_context, load_tone_knowledge, search_tone_knowledge


def test_loads_tone_knowledge_markdown_db():
    entries = load_tone_knowledge()

    ids = {entry.id for entry in entries}
    assert "safe-transport-scheduling" in ids
    assert "noise-fx-gestures" in ids
    assert "parameter-ramping-and-graph-safety" in ids
    assert all(Path(entry.path).exists() for entry in entries)


def test_searches_korean_natural_arrangement_language_into_recipes():
    results = search_tone_knowledge("드랍 전에 숨 참는 느낌으로 스터터 게이트랑 딜레이")

    assert results
    assert results[0].score > 0
    assert any(result.entry.id == "noise-fx-gestures" for result in results)


def test_builds_bounded_context_with_sources_for_llm_prompt():
    context = build_tone_context("다음 마디에 라이저로 들어올리고 필터를 열어줘", max_chars=900)

    assert "source:" in context
    assert "tone@15.1.22" in context
    assert "graph" in context.lower() or "NoiseSynth" in context
    assert len(context) <= 950
