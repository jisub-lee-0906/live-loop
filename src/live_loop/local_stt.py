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
DEFAULT_STT_BEAM_SIZE = 5
MAX_STT_UPLOAD_BYTES = int(os.getenv("LIVE_LOOP_MAX_STT_UPLOAD_BYTES", str(16 * 1024 * 1024)))
MAX_STT_UPLOAD_SECONDS = float(os.getenv("LIVE_LOOP_MAX_STT_UPLOAD_SECONDS", "15"))
DEFAULT_STT_INITIAL_PROMPT = (
    "라이브 루프스테이션 한국어 짧은 음성 명령. "
    "가능한 명령: 킥 깔아줘, 하이햇 얹어줘, 베이스 넣어줘, 패드 넓게 깔아줘, "
    "드럼 더 몰아줘, 베이스 빼줘, 다시 드랍, 스윙 0.7, bpm 150, 멈춰."
)


@dataclass(frozen=True)
class LocalSttStatus:
    mode: str
    model_name: str
    language: str
    device: str
    compute_type: str
    beam_size: int
    has_initial_prompt: bool
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


def get_stt_beam_size() -> int:
    raw = _env("LIVE_LOOP_STT_BEAM_SIZE", str(DEFAULT_STT_BEAM_SIZE))
    try:
        return max(1, min(8, int(raw)))
    except ValueError:
        return DEFAULT_STT_BEAM_SIZE


def get_stt_initial_prompt() -> str:
    return _env("LIVE_LOOP_STT_INITIAL_PROMPT", DEFAULT_STT_INITIAL_PROMPT)


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
        beam_size=get_stt_beam_size(),
        has_initial_prompt=bool(get_stt_initial_prompt()),
        runtime_available=runtime_available,
        ready=runtime_available,
    )


LIVE_COMMAND_KEYWORDS = (
    "킥",
    "kick",
    "하이햇",
    "햇",
    "hat",
    "스네어",
    "snare",
    "베이스",
    "bass",
    "패드",
    "pad",
    "드럼",
    "drum",
    "스윙",
    "swing",
    "bpm",
    "템포",
    "드랍",
    "drop",
    "멈춰",
    "정지",
    "panic",
    "전체",
    "어둡",
    "밝",
    "리버브",
    "볼륨",
    "릴리즈",
    "어택",
    "크게",
    "작게",
    "다시",
)


def _looks_like_live_command(text: str) -> bool:
    normalized = text.lower().replace(" ", "")
    return any(keyword.lower().replace(" ", "") in normalized for keyword in LIVE_COMMAND_KEYWORDS)


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
        transcribe_options = {
            "language": language or get_stt_language() or None,
            "beam_size": get_stt_beam_size(),
            "initial_prompt": get_stt_initial_prompt() or None,
            "condition_on_previous_text": False,
            "temperature": 0.0,
        }
        first_segments, info = model.transcribe(str(path), vad_filter=True, **transcribe_options)
        text = " ".join(segment.text.strip() for segment in first_segments if segment.text.strip()).strip()
        if not text or not _looks_like_live_command(text):
            retry_segments, retry_info = model.transcribe(str(path), vad_filter=False, **transcribe_options)
            retry_text = " ".join(segment.text.strip() for segment in retry_segments if segment.text.strip()).strip()
            if retry_text and _looks_like_live_command(retry_text):
                text = retry_text
                info = retry_info
            elif text and not _looks_like_live_command(text):
                text = ""
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
        started = time.monotonic()
        written = 0
        tmp_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(prefix="live-loop-stt-", suffix=suffix, delete=False) as tmp:
                tmp_path = Path(tmp.name)
                while chunk := file.read(1024 * 1024):
                    written += len(chunk)
                    if written > MAX_STT_UPLOAD_BYTES:
                        raise ValueError("audio upload is too large")
                    if time.monotonic() - started > MAX_STT_UPLOAD_SECONDS:
                        raise TimeoutError("audio upload took too long")
                    tmp.write(chunk)
            return self.transcribe_file(tmp_path, language=language)
        finally:
            if tmp_path is not None:
                tmp_path.unlink(missing_ok=True)


@lru_cache(maxsize=1)
def get_local_transcriber() -> LocalSpeechTranscriber:
    return LocalSpeechTranscriber()
