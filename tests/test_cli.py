import json

from typer.testing import CliRunner

from live_loop.cli import app
from live_loop.local_llm import LlmLatencyReport, LlmLatencySample


runner = CliRunner()


def test_doctor_reports_ready_statuses(monkeypatch, tmp_path):
    model = tmp_path / "live-coder.gguf"
    model.write_bytes(b"gguf")
    monkeypatch.setenv("LIVE_LOOP_LLM_MODEL", str(model))
    monkeypatch.setenv("LIVE_LOOP_STT_MODEL", "small")
    monkeypatch.setenv("LIVE_LOOP_STT_LANGUAGE", "ko")

    result = runner.invoke(app, ["doctor"])

    assert result.exit_code == 0
    assert "live-loop doctor" in result.stdout
    assert "STT" in result.stdout
    assert "LLM" in result.stdout
    assert "faster-whisper" in result.stdout
    assert "local-gguf" in result.stdout
    assert str(model.resolve()) in result.stdout


def test_doctor_can_emit_machine_readable_json(monkeypatch, tmp_path):
    model = tmp_path / "missing.gguf"
    monkeypatch.setenv("LIVE_LOOP_LLM_MODEL", str(model))

    result = runner.invoke(app, ["doctor", "--json"])

    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert payload["ok"] is False
    assert payload["stt"]["mode"] == "faster-whisper"
    assert payload["llm"]["mode"] == "local-gguf"
    assert payload["llm"]["ready"] is False
    assert payload["llm"]["model_path"] == str(model.resolve())


def test_benchmark_llm_cli_outputs_latency_json(monkeypatch):
    import live_loop.cli as cli

    def fake_benchmark(*, prompts):
        assert prompts == ["킥 깔아줘"]
        return LlmLatencyReport(
            ready=True,
            model_path="/models/live-coder.gguf",
            samples=[LlmLatencySample(prompt="킥 깔아줘", latency_ms=123, ok=True)],
            cold_latency_ms=123,
            warm_p50_latency_ms=123,
            max_latency_ms=123,
            recommended_frontend_timeout_ms=1500,
        )

    monkeypatch.setattr(cli, "benchmark_intent_latency", fake_benchmark)

    result = runner.invoke(app, ["benchmark-llm", "--json", "--prompt", "킥 깔아줘"])

    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert payload["ready"] is True
    assert payload["samples"][0]["latency_ms"] == 123
    assert payload["recommended_frontend_timeout_ms"] == 1500
