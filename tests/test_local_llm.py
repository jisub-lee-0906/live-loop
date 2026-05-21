from pathlib import Path

from live_loop.local_llm import LocalLiveCoder, configured_model_path, get_local_model_status


def test_configured_model_path_defaults_to_repo_model_slot(monkeypatch):
    monkeypatch.delenv("LIVE_LOOP_LLM_MODEL", raising=False)

    path = configured_model_path()

    assert path.name == "live-coder.gguf"
    assert path.parent.name == "llm"
    assert path.parent.parent.name == "models"


def test_configured_model_path_accepts_env_override(monkeypatch, tmp_path):
    model = tmp_path / "custom.gguf"
    monkeypatch.setenv("LIVE_LOOP_LLM_MODEL", str(model))

    assert configured_model_path() == model.resolve()


def test_local_model_status_reports_missing_model(monkeypatch, tmp_path):
    missing = tmp_path / "missing.gguf"
    monkeypatch.setenv("LIVE_LOOP_LLM_MODEL", str(missing))

    status = get_local_model_status()

    assert status.mode == "local-gguf"
    assert status.model_path == str(missing.resolve())
    assert status.exists is False
    assert status.ready is False
    assert "missing" in status.message


def test_local_live_coder_never_calls_api_when_model_missing(monkeypatch, tmp_path):
    missing = tmp_path / "missing.gguf"
    monkeypatch.setenv("LIVE_LOOP_LLM_MODEL", str(missing))

    coder = LocalLiveCoder(Path(missing))

    assert coder.ready() is False
