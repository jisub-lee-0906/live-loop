import { applyCommand, type LayerId, type LoopState } from './loopState'
import { applyMusicPatches, type MusicPatch, type MusicPatchTiming } from './musicPatch'
import { getPatchById } from './patchCatalog'
import type { LiveCodeIntent } from './patternDsl'
import { musicPatchesFromArrangementPlan, type ArrangementPlan } from './arrangementPlan'

export interface BackendCommandResponse {
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
  source: 'local-live-code' | 'backend' | 'backend-timeout' | 'backend-fallback' | 'local-gguf' | 'arrangement-plan' | 'llm-timeout'
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
const BACKEND_TIMEOUT_MS = Number(import.meta.env.VITE_LIVE_LOOP_BACKEND_TIMEOUT_MS ?? 1200)
const LLM_TIMEOUT_MS = Number(import.meta.env.VITE_LIVE_LOOP_LLM_TIMEOUT_MS ?? 1500)
const STT_TIMEOUT_MS = Number(import.meta.env.VITE_LIVE_LOOP_STT_TIMEOUT_MS ?? 10000)

export interface BackendMusicAction {
  intent: string
  target: string
  value: number
  delta: number
  timing: string
}

function isLayerId(target: string): target is LayerId {
  return ['kick', 'snare', 'hats', 'bass', 'pad', 'lead'].includes(target)
}

function backendTiming(timing: string): MusicPatchTiming {
  return timing === 'now' ? 'now' : 'next_bar'
}

function drumTargets(target: string): LayerId[] {
  if (target === 'drums') return ['kick', 'snare', 'hats']
  return isLayerId(target) ? [target] : []
}

function patchForBackendAction(state: LoopState, action: BackendMusicAction, target: LayerId, index: number): MusicPatch {
  const timing = backendTiming(action.timing)
  if (action.intent === 'add_layer' || action.intent === 'unmute_layer') {
    return {
      id: `backend-${action.intent}-${target}-${index}`,
      label: `Backend ${action.intent} ${target}`,
      target,
      timing,
      operations: [
        { type: 'set_enabled', value: true },
        ...(action.intent === 'add_layer' ? [{ type: 'set_volume' as const, value: action.value }] : []),
      ],
    }
  }
  if (action.intent === 'mute_layer' || action.intent === 'panic') {
    return {
      id: `backend-${action.intent}-${target}-${index}`,
      label: `Backend ${action.intent} ${target}`,
      target,
      timing,
      operations: [{ type: 'set_enabled', value: false }],
    }
  }
  return {
    id: `backend-${action.intent}-${target}-${index}`,
    label: `Backend ${action.intent} ${target}`,
    target,
    timing,
    operations: [{ type: 'set_complexity', value: Math.min(1, Math.max(0, state.layers[target].complexity + action.delta)) }],
  }
}

export function applyBackendCommandAction(state: LoopState, text: string, action: BackendMusicAction): LoopState {
  const targets = action.intent === 'panic' ? (['kick', 'snare', 'hats', 'bass', 'pad', 'lead'] as LayerId[]) : drumTargets(action.target)
  if (!targets.length) return applyCommand(state, text)
  const patches = targets.map((target, index) => patchForBackendAction(state, action, target, index))
  const next = applyMusicPatches(state, patches, text)
  const latest = next.commandLog[0]
  return {
    ...next,
    commandLog: latest
      ? [
          {
            ...latest,
            action: 'backend_action',
            target: action.target === 'drums' ? 'drums' : latest.target,
            summary: `backend action ${action.intent}을 구조화 데이터로 반영했어요`,
          },
          ...next.commandLog.slice(1),
        ]
      : next.commandLog,
  }
}

function commandFromBackendAction(state: LoopState, text: string, response: BackendCommandResponse): LoopState {
  return applyBackendCommandAction(state, text, response.action)
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
  } catch (error) {
    const source = error instanceof DOMException && error.name === 'AbortError' ? 'backend-timeout' : 'backend-fallback'
    return { state: applyCommand(state, text), source, latencyMs: performance.now() - start }
  } finally {
    window.clearTimeout(timeout)
  }
}

interface ArrangementPlanResponse {
  ok: boolean
  plan: ArrangementPlan
  source: string
}

interface SttResponse {
  ok: boolean
  transcript: SttTranscript
  source: string
}

function commandTextFromIntent(text: string, intent: LiveCodeIntent): string {
  const lower = text.toLowerCase()
  if (lower.includes('둥글') || lower.includes('따뜻') || lower.includes('warm') || lower.includes('round')) return '베이스 둥글게 넣어줘'
  if (lower.includes('어둡') || lower.includes('dark')) return lower.includes('전체') || lower.includes('믹스') ? '전체 좀 어둡게' : '어두운 베이스 넣어줘'
  if (lower.includes('드랍') || lower.includes('drop')) return '다시 드랍'
  if (intent.targets.includes('bass')) return intent.constraints.includes('rubbery_pluck') ? '고무 베이스 넣어줘' : '베이스 둥글게 넣어줘'
  if (intent.targets.includes('pad') || intent.constraints.includes('wide_pad')) return '패드 넓게 깔아줘'
  if (intent.targets.includes('lead') || intent.constraints.includes('sparkle_arp')) return '위에 반짝이는 아르페지오 살짝'
  if (intent.targets.includes('drums') || intent.constraints.includes('shuffle_hats') || intent.style === 'uk_garage') return '킥은 유지하고 드럼 더 몰아줘'
  return text
}

function intentTiming(timing: string): MusicPatchTiming {
  if (timing === 'now' || timing === 'next_step' || timing === 'next_bar') return timing
  return 'next_bar'
}

function cloneWithTiming(patch: MusicPatch, timing: MusicPatchTiming): MusicPatch {
  return { ...patch, timing, operations: patch.operations.map((operation) => ({ ...operation })) }
}

export function applyLiveCodeIntent(state: LoopState, text: string, intent: LiveCodeIntent): LoopState {
  const timing = intentTiming(intent.timing)
  const patchIds: string[] = []
  if (intent.targets.includes('drums') || intent.constraints.includes('shuffle_hats') || intent.style === 'uk_garage') patchIds.push('drums-busier-ukg-v0')
  if (intent.targets.includes('bass')) patchIds.push(intent.constraints.includes('rubbery_pluck') ? 'bass-rubbery-pluck-v0' : 'bass-dark-sub-v0')
  if (intent.targets.includes('pad') || intent.constraints.includes('wide_pad')) patchIds.push('pad-wide-minor-v0')
  if (intent.targets.includes('lead') || intent.constraints.includes('sparkle_arp')) patchIds.push('lead-sparkle-arp-v0')

  const patches = patchIds.map((id) => getPatchById(id)).filter((patch): patch is MusicPatch => Boolean(patch)).map((patch) => cloneWithTiming(patch, timing))
  if (!patches.length) return applyCommand(state, commandTextFromIntent(text, intent))
  const next = applyMusicPatches(state, patches, text)
  const latest = next.commandLog[0]
  return {
    ...next,
    commandLog: latest
      ? [
          {
            ...latest,
            action: 'llm_intent_patch',
            target: 'pattern',
            summary: `${patches.length}개 LLM intent 패치를 구조화 데이터로 반영했어요`,
          },
          ...next.commandLog.slice(1),
        ]
      : next.commandLog,
  }
}

export function applyArrangementPlan(state: LoopState, text: string, plan: ArrangementPlan, source = 'arrangement-plan'): LoopState {
  const patches = musicPatchesFromArrangementPlan(plan)
  if (!patches.length) return applyCommand(state, text)
  const next = applyMusicPatches(state, patches, text)
  const latest = next.commandLog[0]
  return {
    ...next,
    commandLog: latest
      ? [
          {
            ...latest,
            action: 'arrangement_plan_patch',
            target: patches.length === 1 ? patches[0].target : 'pattern',
            summary: `${patches.length}개 parameterized ArrangementPlan 패치를 ${plan.timing === 'next_phrase' ? '다음 프레이즈' : '다음 안전 지점'}에 예약했어요`,
            plan: {
              source,
              planSummary: plan.summary,
              knowledgeEntryIds: [...plan.knowledge_entry_ids],
              preserve: [...plan.preserve],
              confidence: plan.confidence,
            },
          },
          ...next.commandLog.slice(1),
        ]
      : next.commandLog,
  }
}

async function applyViaLocalLlm(state: LoopState, text: string, start: number): Promise<CommandApplyResult> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)
  try {
    const response = await fetch(`${API_BASE}/api/llm/arrange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, loop_state: state }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`llm ${response.status}`)
    const body = (await response.json()) as ArrangementPlanResponse
    const source = body.source === 'local-gguf' ? 'local-gguf' : body.source || 'arrangement-plan'
    return { state: applyArrangementPlan(state, text, body.plan, source), source: source === 'local-gguf' ? 'local-gguf' : 'arrangement-plan', latencyMs: performance.now() - start }
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

function isLocalTransportCommand(text: string): boolean {
  const normalized = text.toLowerCase()
  return (
    normalized.includes('panic') ||
    normalized.includes('패닉') ||
    normalized.includes('비상') ||
    normalized.includes('kill') ||
    normalized.includes('킬') ||
    normalized.includes('멈춰') ||
    normalized.includes('정지') ||
    normalized.includes('stop') ||
    normalized.includes('스탑')
  )
}

export async function applyCommandWithBackend(state: LoopState, text: string): Promise<LoopState> {
  return (await applyCommandFast(state, text)).state
}

export async function applyCommandFast(state: LoopState, text: string): Promise<CommandApplyResult> {
  const start = performance.now()
  // Transport safety commands must stay deterministic/local. Backend or LLM
  // mappings can collapse panic/stop distinctions, which is unsafe live.
  if (isLocalTransportCommand(text)) return { state: applyCommand(state, text), source: 'local-live-code', latencyMs: performance.now() - start }
  if (USE_LOCAL_LLM) return applyViaLocalLlm(state, text, start)
  if (USE_BACKEND_COMMANDS) return applyViaBackend(state, text, start)
  return { state: applyCommand(state, text), source: 'local-live-code', latencyMs: performance.now() - start }
}
