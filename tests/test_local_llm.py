from pathlib import Path

from live_loop.local_llm import LocalLiveCoder, benchmark_intent_latency, configured_model_path, get_local_model_status


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


def test_benchmark_intent_latency_records_cold_and_warm_samples(tmp_path):
    class FakeCoder:
        model_path = tmp_path / "fake.gguf"

        def ready(self):
            return True

        def interpret_intent(self, text: str):
            calls.append(text)
            return object()

    calls: list[str] = []
    ticks = iter([10.0, 10.2, 20.0, 20.3])

    report = benchmark_intent_latency(
        FakeCoder(),
        prompts=["킥 깔아줘", "하이햇 얹어줘"],
        clock=lambda: next(ticks),
    )

    assert report.ready is True
    assert calls == ["킥 깔아줘", "하이햇 얹어줘"]
    assert [sample.latency_ms for sample in report.samples] == [200, 300]
    assert report.cold_latency_ms == 200
    assert report.warm_p50_latency_ms == 300
    assert report.max_latency_ms == 300
    assert report.recommended_frontend_timeout_ms >= 1500


def test_benchmark_intent_latency_skips_generation_when_not_ready(tmp_path):
    class MissingCoder:
        model_path = tmp_path / "missing.gguf"

        def ready(self):
            return False

        def interpret_intent(self, text: str):
            raise AssertionError("must not generate when the model is not ready")

    report = benchmark_intent_latency(MissingCoder(), prompts=["킥 깔아줘"])

    assert report.ready is False
    assert report.samples == []
    assert report.max_latency_ms == 0
