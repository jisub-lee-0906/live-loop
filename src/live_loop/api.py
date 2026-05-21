from __future__ import annotations

from functools import lru_cache

from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .actions import MusicAction, parse_fast_command
from .live_intent import LiveCodeIntent, compose_rule_intent
from .local_llm import LocalLiveCoder, LocalModelStatus, get_local_model_status
from .local_stt import LocalSttStatus, SttTranscript, get_local_stt_status, get_local_transcriber


class CommandRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class CommandResponse(BaseModel):
    ok: bool
    action: MusicAction
    source: str = "rules"


class ModelStatusResponse(BaseModel):
    ok: bool
    model: LocalModelStatus


class IntentResponse(BaseModel):
    ok: bool
    intent: LiveCodeIntent
    source: str


class SttStatusResponse(BaseModel):
    ok: bool
    stt: LocalSttStatus


class SttTranscriptResponse(BaseModel):
    ok: bool
    transcript: SttTranscript
    source: str = "faster-whisper"


app = FastAPI(title="live-loop API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def get_local_coder() -> LocalLiveCoder:
    return LocalLiveCoder()


@app.get("/api/health")
def health() -> dict[str, bool | str]:
    return {"ok": True, "service": "live-loop-api"}


@app.get("/api/model/status", response_model=ModelStatusResponse)
def model_status() -> ModelStatusResponse:
    return ModelStatusResponse(ok=True, model=get_local_model_status())


@app.get("/api/stt/status", response_model=SttStatusResponse)
def stt_status() -> SttStatusResponse:
    return SttStatusResponse(ok=True, stt=get_local_stt_status())


@app.post("/api/stt/transcribe", response_model=SttTranscriptResponse)
def transcribe_audio(file: UploadFile = File(...), language: str | None = None) -> SttTranscriptResponse:
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=415, detail="audio file upload is required")
    suffix = Path(file.filename or "recording.webm").suffix or ".webm"
    try:
        transcript = get_local_transcriber().transcribe_upload(file.file, suffix=suffix, language=language)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"STT transcription failed: {exc}") from exc
    return SttTranscriptResponse(ok=True, transcript=transcript)


@app.post("/api/command", response_model=CommandResponse)
def interpret_command(request: CommandRequest) -> CommandResponse:
    action = parse_fast_command(request.text)
    if action is None:
        raise HTTPException(status_code=422, detail="아직 이해하지 못한 명령이에요. 규칙 파서나 LLM fallback이 필요합니다.")
    return CommandResponse(ok=True, action=action)


@app.post("/api/llm/intent", response_model=IntentResponse)
def interpret_intent(request: CommandRequest) -> IntentResponse:
    coder = get_local_coder()
    if not coder.ready():
        return IntentResponse(ok=True, intent=compose_rule_intent(request.text), source="rules-fallback")
    try:
        return IntentResponse(ok=True, intent=coder.interpret_intent(request.text), source="local-gguf")
    except Exception:
        return IntentResponse(ok=True, intent=compose_rule_intent(request.text), source="rules-fallback")
