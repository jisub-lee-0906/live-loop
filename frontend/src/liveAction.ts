import { resolveLayerRuntimeParams } from './audioRuntimeParams'
import type { LayerId, LoopLayer, LoopState } from './loopState'
import { snapshotLoopState, type MusicPatchMacroValue, type MusicPatchTiming } from './musicPatch'
import { patternToLiveCode } from './patternDsl'

export type LiveActionTarget = LayerId | 'transport' | 'mix'
export type LiveActionValue = string | number | boolean
export type LiveActionTiming = MusicPatchTiming

export type LiveAction =
  | { type: 'set_param'; target: LiveActionTarget; path: string; value: LiveActionValue; timing?: LiveActionTiming }
  | { type: 'mod_param'; target: LiveActionTarget; path: string; delta: number; timing?: LiveActionTiming }

export interface LiveParamSpec {
  key: string
  target: LiveActionTarget
  path: string
  valueType: 'number' | 'enum' | 'boolean'
  min?: number
  max?: number
  values?: string[]
  timingPolicy: LiveActionTiming
  stateKind: 'layer_field' | 'layer_macro' | 'transport_bpm' | 'transport_swing' | 'unsupported'
  layerField?: 'volume' | 'complexity'
  macroName?: string
}

export type ValidationResult =
  | { ok: true; action: Required<LiveAction>; spec: LiveParamSpec }
  | { ok: false; reason: 'unsupported_param' | 'invalid_value' | 'invalid_target' }

function spec(spec: Omit<LiveParamSpec, 'key'>): LiveParamSpec {
  return { ...spec, key: `${spec.target}.${spec.path}` }
}

const numericLayerSpecs = [
  spec({ target: 'kick', path: 'volume', valueType: 'number', min: 0, max: 1, timingPolicy: 'now', stateKind: 'layer_field', layerField: 'volume' }),
  spec({ target: 'snare', path: 'volume', valueType: 'number', min: 0, max: 1, timingPolicy: 'now', stateKind: 'layer_field', layerField: 'volume' }),
  spec({ target: 'hats', path: 'volume', valueType: 'number', min: 0, max: 1, timingPolicy: 'now', stateKind: 'layer_field', layerField: 'volume' }),
  spec({ target: 'bass', path: 'volume', valueType: 'number', min: 0, max: 1, timingPolicy: 'now', stateKind: 'layer_field', layerField: 'volume' }),
  spec({ target: 'pad', path: 'volume', valueType: 'number', min: 0, max: 1, timingPolicy: 'now', stateKind: 'layer_field', layerField: 'volume' }),
  spec({ target: 'lead', path: 'volume', valueType: 'number', min: 0, max: 1, timingPolicy: 'now', stateKind: 'layer_field', layerField: 'volume' }),
  spec({ target: 'texture', path: 'volume', valueType: 'number', min: 0, max: 1, timingPolicy: 'now', stateKind: 'layer_field', layerField: 'volume' }),
  spec({ target: 'fx', path: 'volume', valueType: 'number', min: 0, max: 1, timingPolicy: 'now', stateKind: 'layer_field', layerField: 'volume' }),
  spec({ target: 'kick', path: 'detune', valueType: 'number', min: -1200, max: 1200, timingPolicy: 'next_bar', stateKind: 'unsupported' }),
  spec({ target: 'snare', path: 'detune', valueType: 'number', min: -1200, max: 1200, timingPolicy: 'next_bar', stateKind: 'unsupported' }),
  spec({ target: 'hats', path: 'detune', valueType: 'number', min: -1200, max: 1200, timingPolicy: 'next_bar', stateKind: 'unsupported' }),
  spec({ target: 'bass', path: 'detune', valueType: 'number', min: -1200, max: 1200, timingPolicy: 'next_bar', stateKind: 'unsupported' }),
  spec({ target: 'pad', path: 'detune', valueType: 'number', min: -1200, max: 1200, timingPolicy: 'next_bar', stateKind: 'unsupported' }),
]

const oscillatorSpecs = (['kick', 'snare', 'hats', 'bass', 'pad', 'lead', 'texture', 'fx'] as LayerId[]).map((target) =>
  spec({ target, path: 'oscillator.type', valueType: 'enum', values: ['sine', 'square', 'sawtooth', 'triangle'], timingPolicy: 'next_bar', stateKind: 'unsupported' }),
)

const envelopeSpecs = [
  spec({ target: 'pad', path: 'envelope.attack', valueType: 'number', min: 0.001, max: 4, timingPolicy: 'next_bar', stateKind: 'layer_macro', macroName: 'attack' }),
  spec({ target: 'pad', path: 'envelope.decay', valueType: 'number', min: 0.001, max: 4, timingPolicy: 'next_bar', stateKind: 'unsupported' }),
  spec({ target: 'pad', path: 'envelope.sustain', valueType: 'number', min: 0, max: 1, timingPolicy: 'next_bar', stateKind: 'unsupported' }),
  spec({ target: 'pad', path: 'envelope.release', valueType: 'number', min: 0.05, max: 8, timingPolicy: 'next_bar', stateKind: 'layer_macro', macroName: 'release' }),
  spec({ target: 'lead', path: 'envelope.attack', valueType: 'number', min: 0.001, max: 2, timingPolicy: 'next_bar', stateKind: 'layer_macro', macroName: 'attack' }),
  spec({ target: 'lead', path: 'envelope.release', valueType: 'number', min: 0.03, max: 4, timingPolicy: 'next_bar', stateKind: 'layer_macro', macroName: 'release' }),
  spec({ target: 'texture', path: 'envelope.attack', valueType: 'number', min: 0.001, max: 4, timingPolicy: 'next_bar', stateKind: 'layer_macro', macroName: 'attack' }),
  spec({ target: 'texture', path: 'envelope.release', valueType: 'number', min: 0.05, max: 8, timingPolicy: 'next_bar', stateKind: 'layer_macro', macroName: 'release' }),
  spec({ target: 'fx', path: 'envelope.attack', valueType: 'number', min: 0.001, max: 4, timingPolicy: 'next_bar', stateKind: 'layer_macro', macroName: 'attack' }),
  spec({ target: 'fx', path: 'envelope.release', valueType: 'number', min: 0.05, max: 8, timingPolicy: 'next_bar', stateKind: 'layer_macro', macroName: 'release' }),
  spec({ target: 'bass', path: 'envelope.attack', valueType: 'number', min: 0.001, max: 2, timingPolicy: 'next_bar', stateKind: 'unsupported' }),
  spec({ target: 'bass', path: 'envelope.decay', valueType: 'number', min: 0.001, max: 3, timingPolicy: 'next_bar', stateKind: 'unsupported' }),
  spec({ target: 'bass', path: 'envelope.sustain', valueType: 'number', min: 0, max: 1, timingPolicy: 'next_bar', stateKind: 'unsupported' }),
  spec({ target: 'bass', path: 'envelope.release', valueType: 'number', min: 0.02, max: 4, timingPolicy: 'next_bar', stateKind: 'unsupported' }),
]

const effectSpecs = [
  spec({ target: 'pad', path: 'effect.reverb.wet', valueType: 'number', min: 0, max: 1, timingPolicy: 'next_bar', stateKind: 'layer_macro', macroName: 'reverbWet' }),
  spec({ target: 'snare', path: 'effect.reverb.wet', valueType: 'number', min: 0, max: 1, timingPolicy: 'next_bar', stateKind: 'layer_macro', macroName: 'reverbWet' }),
  spec({ target: 'lead', path: 'effect.reverb.wet', valueType: 'number', min: 0, max: 1, timingPolicy: 'next_bar', stateKind: 'layer_macro', macroName: 'reverbWet' }),
  spec({ target: 'lead', path: 'effect.delay.wet', valueType: 'number', min: 0, max: 1, timingPolicy: 'next_bar', stateKind: 'layer_macro', macroName: 'delayWet' }),
  spec({ target: 'texture', path: 'effect.reverb.wet', valueType: 'number', min: 0, max: 1, timingPolicy: 'next_bar', stateKind: 'layer_macro', macroName: 'reverbWet' }),
  spec({ target: 'fx', path: 'effect.reverb.wet', valueType: 'number', min: 0, max: 1, timingPolicy: 'next_bar', stateKind: 'layer_macro', macroName: 'reverbWet' }),
  spec({ target: 'fx', path: 'effect.delay.wet', valueType: 'number', min: 0, max: 1, timingPolicy: 'next_bar', stateKind: 'layer_macro', macroName: 'delayWet' }),
  spec({ target: 'mix', path: 'effect.delay.wet', valueType: 'number', min: 0, max: 1, timingPolicy: 'next_bar', stateKind: 'unsupported' }),
  spec({ target: 'mix', path: 'effect.delay.delayTime', valueType: 'number', min: 0.01, max: 2, timingPolicy: 'next_bar', stateKind: 'unsupported' }),
  spec({ target: 'mix', path: 'effect.delay.feedback', valueType: 'number', min: 0, max: 0.95, timingPolicy: 'next_bar', stateKind: 'unsupported' }),
]

const transportSpecs = [
  spec({ target: 'transport', path: 'bpm', valueType: 'number', min: 60, max: 180, timingPolicy: 'next_phrase', stateKind: 'transport_bpm' }),
  spec({ target: 'transport', path: 'swing', valueType: 'number', min: 0, max: 0.75, timingPolicy: 'next_bar', stateKind: 'transport_swing' }),
  spec({ target: 'transport', path: 'timeSignature', valueType: 'enum', values: ['4/4', '3/4'], timingPolicy: 'next_phrase', stateKind: 'unsupported' }),
]

export const liveParamRegistry: Record<string, LiveParamSpec> = [
  ...numericLayerSpecs,
  ...oscillatorSpecs,
  ...envelopeSpecs,
  ...effectSpecs,
  ...transportSpecs,
].reduce<Record<string, LiveParamSpec>>((acc, item) => {
  acc[item.key] = item
  return acc
}, {})

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function currentLayerMacroValue(state: LoopState, spec: LiveParamSpec): number | undefined {
  if (!spec.macroName || spec.target === 'transport' || spec.target === 'mix') return undefined
  const layer = state.layers[spec.target]
  const explicit = layer.macros?.[spec.macroName]
  if (typeof explicit === 'number') return explicit
  const runtime = resolveLayerRuntimeParams(layer)
  if (runtime.kind === 'pad') {
    if (spec.macroName === 'attack') return runtime.attack
    if (spec.macroName === 'release') return runtime.release
    if (spec.macroName === 'reverbWet') return runtime.reverbWet
    if (spec.macroName === 'filterCutoff') return runtime.filterCutoff
  }
  if (runtime.kind === 'snare' && spec.macroName === 'reverbWet') return runtime.reverbWet
  if (runtime.kind === 'bass') {
    if (spec.macroName === 'filterCutoff') return runtime.filterCutoff
    if (spec.macroName === 'resonance') return runtime.resonance
    if (spec.macroName === 'drive') return runtime.drive
  }
  if (runtime.kind === 'kick' && spec.macroName === 'drive') return runtime.drive
  if (runtime.kind === 'hats' && spec.macroName === 'release') return runtime.release
  if (runtime.kind === 'lead') {
    if (spec.macroName === 'attack') return runtime.attack
    if (spec.macroName === 'release') return runtime.release
    if (spec.macroName === 'reverbWet') return runtime.reverbWet
    if (spec.macroName === 'delayWet') return runtime.delayWet
    if (spec.macroName === 'filterCutoff') return runtime.filterCutoff
  }
  if (runtime.kind === 'texture') {
    if (spec.macroName === 'attack') return runtime.attack
    if (spec.macroName === 'release') return runtime.release
    if (spec.macroName === 'reverbWet') return runtime.reverbWet
    if (spec.macroName === 'filterCutoff') return runtime.filterCutoff
  }
  if (runtime.kind === 'fx') {
    if (spec.macroName === 'attack') return runtime.attack
    if (spec.macroName === 'release') return runtime.release
    if (spec.macroName === 'reverbWet') return runtime.reverbWet
    if (spec.macroName === 'delayWet') return runtime.delayWet
    if (spec.macroName === 'filterCutoff') return runtime.filterCutoff
  }
  return undefined
}

function currentValue(state: LoopState, spec: LiveParamSpec): number | undefined {
  if (spec.stateKind === 'layer_field' && spec.layerField && spec.target !== 'transport' && spec.target !== 'mix') {
    return state.layers[spec.target][spec.layerField]
  }
  if (spec.stateKind === 'layer_macro') return currentLayerMacroValue(state, spec)
  if (spec.stateKind === 'transport_bpm') return state.bpm
  if (spec.stateKind === 'transport_swing') return state.pattern.layers.drums.swing
  return undefined
}

function normalizeValue(action: LiveAction, spec: LiveParamSpec, state?: LoopState): LiveActionValue | undefined {
  if (action.type === 'mod_param') {
    if (spec.valueType !== 'number' || typeof action.delta !== 'number') return undefined
    const base = state ? currentValue(state, spec) : 0
    return clamp((base ?? 0) + action.delta, spec.min ?? Number.NEGATIVE_INFINITY, spec.max ?? Number.POSITIVE_INFINITY)
  }

  if (spec.valueType === 'number') return typeof action.value === 'number' ? clamp(action.value, spec.min ?? action.value, spec.max ?? action.value) : undefined
  if (spec.valueType === 'boolean') return typeof action.value === 'boolean' ? action.value : undefined
  return typeof action.value === 'string' && spec.values?.includes(action.value) ? action.value : undefined
}

export function validateLiveAction(action: LiveAction, state?: LoopState): ValidationResult {
  const registryKey = `${action.target}.${action.path}`
  const spec = liveParamRegistry[registryKey]
  if (!spec) return { ok: false, reason: 'unsupported_param' }
  if (spec.stateKind === 'unsupported') return { ok: false, reason: 'unsupported_param' }

  const normalizedValue = normalizeValue(action, spec, state)
  if (normalizedValue === undefined) return { ok: false, reason: 'invalid_value' }

  if (action.type === 'set_param') return { ok: true, spec, action: { ...action, value: normalizedValue, timing: spec.timingPolicy } }
  return { ok: true, spec, action: { ...action, delta: typeof normalizedValue === 'number' ? normalizedValue : action.delta, timing: spec.timingPolicy } }
}

function withLiveActionLog(state: LoopState, action: string, text: string, summary: string, target: LayerId | 'pattern'): LoopState {
  return {
    ...state,
    commandLog: [{ id: Date.now(), text, action, target, summary }, ...state.commandLog].slice(0, 8),
  }
}

function setLayer(state: LoopState, layerId: LayerId, patch: Partial<LoopLayer>): LoopState {
  return { ...state, layers: { ...state.layers, [layerId]: { ...state.layers[layerId], ...patch } } }
}

function applyValidatedAction(state: LoopState, validation: Extract<ValidationResult, { ok: true }>): LoopState {
  const { action, spec } = validation
  const value = action.type === 'set_param' ? action.value : action.delta
  const withHistory: LoopState = { ...state, history: [...state.history, snapshotLoopState(state)].slice(-12) }

  if (spec.stateKind === 'layer_field' && spec.layerField && spec.target !== 'transport' && spec.target !== 'mix') {
    return setLayer(withHistory, spec.target, { [spec.layerField]: value } as Partial<LoopLayer>)
  }

  if (spec.stateKind === 'layer_macro' && spec.macroName && spec.target !== 'transport' && spec.target !== 'mix') {
    const macros: Record<string, MusicPatchMacroValue> = { ...withHistory.layers[spec.target].macros, [spec.macroName]: value }
    return setLayer(withHistory, spec.target, { macros })
  }

  if (spec.stateKind === 'transport_bpm' && typeof value === 'number') {
    const pattern = { ...withHistory.pattern, bpm: value }
    return { ...withHistory, bpm: value, pattern, liveCode: patternToLiveCode(pattern) }
  }

  if (spec.stateKind === 'transport_swing' && typeof value === 'number') {
    const pattern = {
      ...withHistory.pattern,
      layers: Object.fromEntries(
        Object.entries(withHistory.pattern.layers).map(([id, layer]) => [id, { ...layer, swing: value }]),
      ) as LoopState['pattern']['layers'],
    }
    return { ...withHistory, pattern, liveCode: patternToLiveCode(pattern) }
  }

  return withHistory
}

export function applyLiveAction(state: LoopState, action: LiveAction, rawText = 'live action'): LoopState {
  const text = rawText.trim() || 'live action'
  const validation = validateLiveAction(action, state)
  if (!validation.ok) return withLiveActionLog({ ...state, pendingPatch: undefined }, 'rejected_live_action', text, `지원하지 않는 파라미터: ${action.target}.${action.path}`, action.target === 'transport' || action.target === 'mix' ? 'pattern' : action.target)

  const next = applyValidatedAction(state, validation)
  const target = validation.spec.target === 'transport' || validation.spec.target === 'mix' ? 'pattern' : validation.spec.target
  return {
    ...withLiveActionLog(next, 'live_action', text, `${validation.spec.key} 값을 안전 범위로 반영했어요`, target),
    pendingPatch: {
      id: `live-param-${validation.spec.target}-${validation.spec.path}`,
      label: `Live param ${validation.spec.key}`,
      target,
      timing: validation.action.timing,
    },
  }
}
