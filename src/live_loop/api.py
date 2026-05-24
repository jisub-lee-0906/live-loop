from __future__ import annotations

from functools import lru_cache
from time import perf_counter

from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .actions import MusicAction, parse_fast_command
from .arrangement_plan import ArrangementPlan, compose_rule_arrangement_plan
from .live_intent import LiveCodeIntent, compose_rule_intent
from .local_llm import LocalLiveCoder, LocalModelStatus, get_local_model_status
from .local_stt import LocalSttStatus, SttTranscript, get_local_stt_status, get_local_transcriber
from .tone_knowledge import ToneKnowledgeSearchResult, search_tone_knowledge


class CommandRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class ArrangeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    loop_state: dict[str, object] | None = None


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


class ArrangementPlanResponse(BaseModel):
    ok: bool
    plan: ArrangementPlan
    source: str


class ToneKnowledgeResponse(BaseModel):
    ok: bool
    query: str
    results: list[ToneKnowledgeSearchResult]


class LlmPrewarmResponse(BaseModel):
    ok: bool
    ready: bool
    source: str
    latency_ms: int
    message: str | None = None


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


@app.get("/api/tone-knowledge/search", response_model=ToneKnowledgeResponse)
def search_tone_docs(q: str, limit: int = 3) -> ToneKnowledgeResponse:
    return ToneKnowledgeResponse(ok=True, query=q, results=search_tone_knowledge(q, limit=limit))


@app.post("/api/llm/arrange", response_model=ArrangementPlanResponse)
def arrange_command(request: ArrangeRequest) -> ArrangementPlanResponse:
    # First pivot step: route natural language through retrieved Tone.js knowledge
    # into a validated declarative plan. When the local model planner is wired,
    # it should emit the same ArrangementPlan shape and still never raw JS.
    return ArrangementPlanResponse(ok=True, plan=compose_rule_arrangement_plan(request.text, request.loop_state), source="rules-with-tone-knowledge")


@app.post("/api/llm/intent", response_model=IntentResponse)
def interpret_intent(request: CommandRequest) -> IntentResponse:
    coder = get_local_coder()
    if not coder.ready():
        return IntentResponse(ok=True, intent=compose_rule_intent(request.text), source="rules-fallback")
    try:
        return IntentResponse(ok=True, intent=coder.interpret_intent(request.text), source="local-gguf")
    except Exception:
        return IntentResponse(ok=True, intent=compose_rule_intent(request.text), source="rules-fallback")


@app.post("/api/llm/prewarm", response_model=LlmPrewarmResponse)
def prewarm_llm(prompt: str = "킥 깔아줘") -> LlmPrewarmResponse:
    coder = get_local_coder()
    if not coder.ready():
        return LlmPrewarmResponse(ok=True, ready=False, source="not-ready", latency_ms=0, message="local LLM is not ready")
    start = perf_counter()
    try:
        coder.interpret_intent(prompt)
    except Exception as exc:  # noqa: BLE001 - prewarm reports model failures to the caller.
        latency_ms = round((perf_counter() - start) * 1000)
        return LlmPrewarmResponse(ok=False, ready=True, source="local-gguf", latency_ms=latency_ms, message=str(exc))
    latency_ms = round((perf_counter() - start) * 1000)
    return LlmPrewarmResponse(ok=True, ready=True, source="local-gguf", latency_ms=latency_ms)
