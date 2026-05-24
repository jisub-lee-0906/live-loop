import { isPatchSupported } from './instrumentCapabilities'
import type { InstrumentMacroName } from './instrumentCapabilities'
import type { LayerId, LoopLayer, LoopSnapshot, LoopState, Subdivision } from './loopState'
import type { AutomationCurve, PatternEvent } from './patternDsl'

export type MusicPatchTiming = 'now' | 'next_step' | 'next_bar' | 'next_phrase'
export type MusicPatchMacroValue = string | number | boolean

export type MusicPatchOperation =
  | { type: 'set_enabled'; value: boolean }
  | { type: 'set_volume'; value: number }
  | { type: 'set_complexity'; value: number }
  | { type: 'set_subdivision'; value: Subdivision }
  | { type: 'set_macro'; name: InstrumentMacroName; value: MusicPatchMacroValue }
  | { type: 'set_pattern_events'; value: PatternEvent[] }
  | { type: 'set_automation'; value: AutomationCurve[] }

export interface MusicPatch {
  id: string
  label: string
  target: LayerId
  timing: MusicPatchTiming
  operations: MusicPatchOperation[]
}

export interface PendingMusicPatch {
  id: string
  label: string
  target: LayerId | 'pattern'
  timing: MusicPatchTiming
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function cloneLayer(layer: LoopLayer): LoopLayer {
  return { ...layer, macros: layer.macros ? { ...layer.macros } : undefined }
}

export function snapshotLoopState(state: LoopState): LoopSnapshot {
  return {
    bpm: state.bpm,
    layers: {
      kick: cloneLayer(state.layers.kick),
      snare: cloneLayer(state.layers.snare),
      hats: cloneLayer(state.layers.hats),
      bass: cloneLayer(state.layers.bass),
      pad: cloneLayer(state.layers.pad),
      lead: cloneLayer(state.layers.lead),
      texture: cloneLayer(state.layers.texture),
      fx: cloneLayer(state.layers.fx),
    },
    pattern: state.pattern,
    liveCode: state.liveCode,
    musicalIntent: { ...state.musicalIntent },
    pendingPatch: state.pendingPatch ? { ...state.pendingPatch } : undefined,
  }
}

function pushHistory(state: LoopState): LoopSnapshot[] {
  return [...state.history, snapshotLoopState(state)].slice(-12)
}

function applyOperation(layer: LoopLayer, operation: MusicPatchOperation): LoopLayer {
  if (operation.type === 'set_enabled') return { ...layer, enabled: operation.value }
  if (operation.type === 'set_volume') return { ...layer, volume: clamp01(operation.value) }
  if (operation.type === 'set_complexity') return { ...layer, complexity: clamp01(operation.value) }
  if (operation.type === 'set_subdivision') return { ...layer, subdivision: operation.value }
  if (operation.type === 'set_pattern_events' || operation.type === 'set_automation') return layer
  return { ...layer, macros: { ...layer.macros, [operation.name]: operation.value } }
}

function applyPatternData(state: LoopState, patch: MusicPatch): LoopState {
  const eventOperation = patch.operations.find((operation) => operation.type === 'set_pattern_events')
  const automationOperation = patch.operations.find((operation) => operation.type === 'set_automation')
  if (!eventOperation && !automationOperation) return state
  if (patch.target !== 'fx') return state
  const patternLayer = state.pattern.layers.fx
  const nextPattern = {
    ...state.pattern,
    layers: {
      ...state.pattern.layers,
      fx: {
        ...patternLayer,
        events: eventOperation ? eventOperation.value.map((event) => ({ ...event })) : patternLayer.events,
        automation: automationOperation ? automationOperation.value.map((curve) => ({ ...curve })) : patternLayer.automation,
      },
    },
  }
  return { ...state, pattern: nextPattern }
}

function withPatchLog(state: LoopState, patch: MusicPatch, text: string, action: 'music_patch' | 'rejected_patch', summary: string): LoopState {
  return {
    ...state,
    commandLog: [{ id: Date.now(), text, action, target: patch.target, summary }, ...state.commandLog].slice(0, 8),
  }
}

function applyValidatedPatch(state: LoopState, patch: MusicPatch): LoopState {
  const currentLayer = state.layers[patch.target]
  const nextLayer = patch.operations.reduce(applyOperation, currentLayer)
  return applyPatternData({
    ...state,
    layers: {
      ...state.layers,
      [patch.target]: nextLayer,
    },
    pendingPatch: {
      id: patch.id,
      label: patch.label,
      target: patch.target,
      timing: patch.timing,
    },
  }, patch)
}

export function applyMusicPatches(state: LoopState, patches: MusicPatch[], rawText = patches.map((patch) => patch.label).join(', ')): LoopState {
  const text = rawText.trim() || 'music patch'
  if (patches.length === 0) return state

  const rejected = patches.find((patch) => !isPatchSupported(patch))
  if (rejected) {
    return withPatchLog({ ...state, pendingPatch: undefined }, rejected, text, 'rejected_patch', `${rejected.label} 패치는 현재 ${rejected.target} 엔진에서 지원하지 않아요`)
  }

  const withHistory: LoopState = { ...state, history: pushHistory(state) }
  const next = patches.reduce(applyValidatedPatch, withHistory)
  const summary = patches.length === 1 ? `${patches[0].label} 패치를 ${patches[0].timing === 'now' ? '즉시' : '다음 안전 지점에'} 예약했어요` : `${patches.length}개 검증 패치를 다음 안전 지점에 예약했어요`

  return {
    ...next,
    commandLog: [{ id: Date.now(), text, action: 'music_patch', target: patches[patches.length - 1].target, summary }, ...state.commandLog].slice(0, 8),
  }
}

export function applyMusicPatch(state: LoopState, patch: MusicPatch, rawText = patch.label): LoopState {
  return applyMusicPatches(state, [patch], rawText)
}
