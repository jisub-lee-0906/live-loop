import { applyCommand, type LoopState } from './loopState'
import { createPatternFromIntent, patternToLiveCode, type LiveCodeIntent } from './patternDsl'

interface BackendCommandResponse {
  ok: boolean
  action: {
    intent: string
    target: string
    value: number
    delta: number
    timing: string
  }
  source: string
}

export interface CommandApplyResult {
  state: LoopState
  source: 'local-live-code' | 'backend' | 'backend-timeout' | 'local-gguf' | 'llm-timeout'
  latencyMs: number
}

export interface SttTranscript {
  text: string
  language: string
  duration: number | null
  model_name: string
  latency_ms: number
}

const API_BASE = import.meta.env.VITE_LIVE_LOOP_API_BASE ?? 'http://127.0.0.1:8101'
const USE_BACKEND_COMMANDS = import.meta.env.VITE_LIVE_LOOP_USE_BACKEND_COMMANDS === '1'
const USE_LOCAL_LLM = import.meta.env.VITE_LIVE_LOOP_USE_LOCAL_LLM === '1'
const BACKEND_TIMEOUT_MS = Number(import.meta.env.VITE_LIVE_LOOP_BACKEND_TIMEOUT_MS ?? 120)
const LLM_TIMEOUT_MS = Number(import.meta.env.VITE_LIVE_LOOP_LLM_TIMEOUT_MS ?? 1500)
const STT_TIMEOUT_MS = Number(import.meta.env.VITE_LIVE_LOOP_STT_TIMEOUT_MS ?? 10000)

function commandFromBackendAction(state: LoopState, text: string, response: BackendCommandResponse): LoopState {
  const action = response.action
  if (action.intent === 'add_layer') return applyCommand(state, text)
  if (action.intent === 'modify_layer') return applyCommand(state, text)
  if (action.intent === 'mute_layer' || action.intent === 'unmute_layer' || action.intent === 'panic') return applyCommand(state, text)
  return applyCommand(state, text)
}

async function applyViaBackend(state: LoopState, text: string, start: number): Promise<CommandApplyResult> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS)
  try {
    const response = await fetch(`${API_BASE}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`backend ${response.status}`)
    const body = (await response.json()) as BackendCommandResponse
    return { state: commandFromBackendAction(state, text, body), source: 'backend', latencyMs: performance.now() - start }
  } catch {
    return { state: applyCommand(state, text), source: 'backend-timeout', latencyMs: performance.now() - start }
  } finally {
    window.clearTimeout(timeout)
  }
}

interface IntentResponse {
  ok: boolean
  intent: LiveCodeIntent
  source: string
}

interface SttResponse {
  ok: boolean
  transcript: SttTranscript
  source: string
}

function applyIntent(state: LoopState, text: string, intent: LiveCodeIntent): LoopState {
  const pattern = createPatternFromIntent(intent)
  const next: LoopState = {
    ...state,
    bpm: pattern.bpm,
    pattern,
    liveCode: patternToLiveCode(pattern),
    layers: {
      ...state.layers,
      kick: { ...state.layers.kick, enabled: true },
      snare: { ...state.layers.snare, enabled: true },
      hats: { ...state.layers.hats, enabled: true, complexity: pattern.layers.drums.swing > 0.55 ? 0.75 : 0.45, subdivision: '16n' },
      bass: { ...state.layers.bass, enabled: intent.targets.includes('bass') },
      pad: { ...state.layers.pad, enabled: intent.targets.includes('pad') || intent.constraints.includes('wide_pad') },
    },
    commandLog: [
      { id: Date.now(), text, action: 'local_llm_intent', target: 'pattern' as const, summary: `${pattern.name} intent를 로컬 GGUF로 해석했어요` },
      ...state.commandLog,
    ].slice(0, 8),
  }
  return next
}

async function applyViaLocalLlm(state: LoopState, text: string, start: number): Promise<CommandApplyResult> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)
  try {
    const response = await fetch(`${API_BASE}/api/llm/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`llm ${response.status}`)
    const body = (await response.json()) as IntentResponse
    return { state: applyIntent(state, text, body.intent), source: body.source === 'local-gguf' ? 'local-gguf' : 'local-live-code', latencyMs: performance.now() - start }
  } catch {
    return { state: applyCommand(state, text), source: 'llm-timeout', latencyMs: performance.now() - start }
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function transcribeAudio(blob: Blob): Promise<SttTranscript> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), STT_TIMEOUT_MS)
  const extension = blob.type.includes('wav') ? 'wav' : blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  const form = new FormData()
  form.append('file', blob, `ptt.${extension}`)
  try {
    const response = await fetch(`${API_BASE}/api/stt/transcribe?language=ko`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`stt ${response.status}`)
    const body = (await response.json()) as SttResponse
    return body.transcript
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function applyCommandWithBackend(state: LoopState, text: string): Promise<LoopState> {
  return (await applyCommandFast(state, text)).state
}

export async function applyCommandFast(state: LoopState, text: string): Promise<CommandApplyResult> {
  const start = performance.now()
  if (USE_LOCAL_LLM) return applyViaLocalLlm(state, text, start)
  if (USE_BACKEND_COMMANDS) return applyViaBackend(state, text, start)
  return { state: applyCommand(state, text), source: 'local-live-code', latencyMs: performance.now() - start }
}
