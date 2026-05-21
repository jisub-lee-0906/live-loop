from __future__ import annotations

import os
import tempfile
import time
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import BinaryIO


DEFAULT_STT_MODEL = "small"
DEFAULT_STT_LANGUAGE = "ko"
DEFAULT_STT_DEVICE = "cpu"
DEFAULT_STT_COMPUTE_TYPE = "int8"


@dataclass(frozen=True)
class LocalSttStatus:
    mode: str
    model_name: str
    language: str
    device: str
    compute_type: str
    runtime_available: bool
    ready: bool


@dataclass(frozen=True)
class SttTranscript:
    text: str
    language: str
    duration: float | None
    model_name: str
    latency_ms: int


def _env(name: str, default: str) -> str:
    value = os.environ.get(name, "").strip()
    return value or default


def get_stt_model_name() -> str:
    return _env("LIVE_LOOP_STT_MODEL", DEFAULT_STT_MODEL)


def get_stt_language() -> str:
    return _env("LIVE_LOOP_STT_LANGUAGE", DEFAULT_STT_LANGUAGE)


def get_stt_device() -> str:
    return _env("LIVE_LOOP_STT_DEVICE", DEFAULT_STT_DEVICE)


def get_stt_compute_type() -> str:
    return _env("LIVE_LOOP_STT_COMPUTE_TYPE", DEFAULT_STT_COMPUTE_TYPE)


def _runtime_available() -> bool:
    try:
        import faster_whisper  # noqa: F401
    except Exception:
        return False
    return True


def get_local_stt_status() -> LocalSttStatus:
    runtime_available = _runtime_available()
    return LocalSttStatus(
        mode="faster-whisper",
        model_name=get_stt_model_name(),
        language=get_stt_language(),
        device=get_stt_device(),
        compute_type=get_stt_compute_type(),
        runtime_available=runtime_available,
        ready=runtime_available,
    )


class LocalSpeechTranscriber:
    def __init__(self, model_name: str | None = None, *, device: str | None = None, compute_type: str | None = None) -> None:
        self.model_name = model_name or get_stt_model_name()
        self.device = device or get_stt_device()
        self.compute_type = compute_type or get_stt_compute_type()
        self._model = None

    def ready(self) -> bool:
        return _runtime_available()

    def _load_model(self):
        if self._model is None:
            from faster_whisper import WhisperModel

            try:
                self._model = WhisperModel(self.model_name, device=self.device, compute_type=self.compute_type)
            except RuntimeError:
                if self.device != "auto" and self.compute_type != "auto":
                    raise
                self.device = "cpu"
                self.compute_type = "int8"
                self._model = WhisperModel(self.model_name, device=self.device, compute_type=self.compute_type)
        return self._model

    def transcribe_file(self, path: str | Path, *, language: str | None = None) -> SttTranscript:
        if not self.ready():
            raise RuntimeError("faster-whisper runtime is not available")
        start = time.perf_counter()
        model = self._load_model()
        segments, info = model.transcribe(str(path), language=language or get_stt_language() or None, beam_size=1, vad_filter=True)
        text = " ".join(segment.text.strip() for segment in segments if segment.text.strip()).strip()
        latency_ms = round((time.perf_counter() - start) * 1000)
        return SttTranscript(
            text=text,
            language=str(getattr(info, "language", None) or language or get_stt_language()),
            duration=getattr(info, "duration", None),
            model_name=self.model_name,
            latency_ms=latency_ms,
        )

    def transcribe_upload(self, file: BinaryIO, *, suffix: str = ".webm", language: str | None = None) -> SttTranscript:
        suffix = suffix if suffix.startswith(".") else f".{suffix}"
        with tempfile.NamedTemporaryFile(prefix="live-loop-stt-", suffix=suffix, delete=False) as tmp:
            tmp.write(file.read())
            tmp_path = Path(tmp.name)
        try:
            return self.transcribe_file(tmp_path, language=language)
        finally:
            tmp_path.unlink(missing_ok=True)


@lru_cache(maxsize=1)
def get_local_transcriber() -> LocalSpeechTranscriber:
    return LocalSpeechTranscriber()
