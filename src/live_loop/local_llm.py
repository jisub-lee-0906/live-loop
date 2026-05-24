from __future__ import annotations

import math
import os
import statistics
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Callable, Sequence

from .live_intent import LiveCodeIntent, parse_model_intent
from .tone_knowledge import build_tone_context

DEFAULT_MODEL_DIR = Path(__file__).resolve().parents[2] / "models" / "llm"
DEFAULT_MODEL_FILENAME = "live-coder.gguf"


@dataclass(frozen=True)
class LocalModelStatus:
    mode: str
    model_path: str
    exists: bool
    runtime: str
    ready: bool
    message: str


@dataclass(frozen=True)
class LlmLatencySample:
    prompt: str
    latency_ms: int
    ok: bool
    error: str | None = None


@dataclass(frozen=True)
class LlmLatencyReport:
    ready: bool
    model_path: str
    samples: list[LlmLatencySample]
    cold_latency_ms: int
    warm_p50_latency_ms: int
    max_latency_ms: int
    recommended_frontend_timeout_ms: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def configured_model_path() -> Path:
    configured = os.getenv("LIVE_LOOP_LLM_MODEL")
    if configured:
        return Path(configured).expanduser().resolve()
    return DEFAULT_MODEL_DIR / DEFAULT_MODEL_FILENAME


def llama_cpp_available() -> bool:
    try:
        import llama_cpp  # noqa: F401
    except Exception:
        return False
    return True


def get_local_model_status() -> LocalModelStatus:
    model_path = configured_model_path()
    exists = model_path.exists()
    runtime_ready = llama_cpp_available()
    ready = exists and runtime_ready
    if ready:
        message = "local GGUF model and llama-cpp runtime are ready"
    elif not exists:
        message = "model file is missing; place a GGUF model at the configured path"
    else:
        message = "model exists, but llama-cpp runtime is not installed"
    return LocalModelStatus(
        mode="local-gguf",
        model_path=str(model_path),
        exists=exists,
        runtime="llama-cpp-python",
        ready=ready,
        message=message,
    )


def benchmark_intent_latency(
    coder: Any | None = None,
    *,
    prompts: Sequence[str] | None = None,
    clock: Callable[[], float] = time.perf_counter,
) -> LlmLatencyReport:
    """Measure local LLM intent latency without touching the audio clock.

    The first successful sample is treated as cold latency because it may include
    lazy model load and KV/cache setup. Remaining samples estimate warm latency.
    """
    coder = coder or LocalLiveCoder()
    model_path = str(getattr(coder, "model_path", configured_model_path()))
    if not coder.ready():
        return LlmLatencyReport(
            ready=False,
            model_path=model_path,
            samples=[],
            cold_latency_ms=0,
            warm_p50_latency_ms=0,
            max_latency_ms=0,
            recommended_frontend_timeout_ms=1500,
        )

    benchmark_prompts = list(
        prompts
        or [
            "킥 깔아줘",
            "하이햇 셔플로 얹어줘",
            "UK garage 느낌으로 베이스 통통 튀게 바꿔줘",
        ]
    )
    samples: list[LlmLatencySample] = []
    for prompt in benchmark_prompts:
        start = clock()
        try:
            coder.interpret_intent(prompt)
        except Exception as exc:  # noqa: BLE001 - benchmark should report failures, not crash mid-run.
            latency_ms = round((clock() - start) * 1000)
            samples.append(LlmLatencySample(prompt=prompt, latency_ms=latency_ms, ok=False, error=str(exc)))
        else:
            latency_ms = round((clock() - start) * 1000)
            samples.append(LlmLatencySample(prompt=prompt, latency_ms=latency_ms, ok=True))

    latencies = [sample.latency_ms for sample in samples]
    cold_latency_ms = latencies[0] if latencies else 0
    warm_latencies = latencies[1:] or latencies
    warm_p50_latency_ms = round(statistics.median(warm_latencies)) if warm_latencies else 0
    max_latency_ms = max(latencies, default=0)
    recommended_frontend_timeout_ms = max(1500, math.ceil(max_latency_ms * 2.5 / 100) * 100)
    return LlmLatencyReport(
        ready=True,
        model_path=model_path,
        samples=samples,
        cold_latency_ms=cold_latency_ms,
        warm_p50_latency_ms=warm_p50_latency_ms,
        max_latency_ms=max_latency_ms,
        recommended_frontend_timeout_ms=recommended_frontend_timeout_ms,
    )


class LocalLiveCoder:
    """Local/bundled LLM boundary for natural-language -> live-code JSON.

    This class intentionally does not call an external API. It is a lazy optional
    runtime wrapper: packaged builds can ship a GGUF file and install/bundle a
    llama.cpp runtime, while development remains testable without a huge model.
    """

    def __init__(self, model_path: Path | None = None) -> None:
        self.model_path = model_path or configured_model_path()
        self._model: Any | None = None

    def ready(self) -> bool:
        return self.model_path.exists() and llama_cpp_available()

    def interpret(self, text: str) -> str:
        """Return raw model text for a future strict JSON validator.

        The real generation call is deliberately gated until a model is present;
        this prevents accidental network/API use and keeps command latency under
        frontend control. The caller should use deterministic/mock live-code when
        this raises RuntimeError.
        """
        if not self.ready():
            raise RuntimeError(get_local_model_status().message)
        if self._model is None:
            import importlib

            llama_cpp = importlib.import_module("llama_cpp")
            self._model = llama_cpp.Llama(model_path=str(self.model_path), n_ctx=2048, n_threads=6, verbose=False)
        assert self._model is not None
        schema = (
            "Return exactly one compact JSON object with keys: "
            "style, targets, constraints, timing, confidence. "
            "style must be one of: house, uk_garage, techno, ambient. "
            "targets must be an array using only: drums, bass, pad, lead, texture, fx, mix. "
            "constraints must be an array using only: shuffle_hats, offbeat_bass, "
            "four_on_floor, tight_kick, ghost_snare, wide_pad, sparkle_arp, vinyl_air, riser_sweep, drop_impact, delay_throw, stutter_gate, minimal, busy. "
            "timing must be one of: now, next_step, next_bar. "
            "Use next_bar unless the user explicitly asks for immediate change. "
            "confidence must be a number from 0 to 1."
        )
        tone_context = build_tone_context(text)
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a fast local music-command intent extractor and live arrangement planner. "
                    "Use the retrieved Tone.js knowledge only as implementation guidance; do not emit JavaScript. "
                    "Return ONLY valid JSON matching the requested schema. "
                    "No markdown. No prose. No thinking. "
                    + schema
                ),
            },
            {
                "role": "user",
                "content": f"/no_think\nCommand: {text}\n\nRelevant Tone.js knowledge:\n{tone_context}",
            },
        ]
        response = self._model.create_chat_completion(messages=messages, max_tokens=160, temperature=0.0)
        return str(response["choices"][0]["message"]["content"]).strip()

    def interpret_intent(self, text: str) -> LiveCodeIntent:
        return parse_model_intent(self.interpret(text), fallback_text=text)
