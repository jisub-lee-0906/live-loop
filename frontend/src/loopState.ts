import { applyMusicPatches, snapshotLoopState } from './musicPatch'
import { applyLiveAction, type LiveAction } from './liveAction'
import { selectDeterministicPatches } from './patchCatalog'
import { createHousePattern, mockLiveCodeCommand, patternToLiveCode, type LiveCodePattern } from './patternDsl'
import type { MusicPatchMacroValue, PendingMusicPatch } from './musicPatch'

export type LayerId = 'kick' | 'snare' | 'hats' | 'bass' | 'pad' | 'lead' | 'texture' | 'fx'

export type Subdivision = '8n' | '16n'

export interface LoopLayer {
  id: LayerId
  label: string
  enabled: boolean
  volume: number
  complexity: number
  subdivision?: Subdivision
  macros?: Record<string, MusicPatchMacroValue>
}

export interface CommandLogPlanMetadata {
  source?: string
  planSummary?: string
  knowledgeEntryIds?: string[]
  preserve?: string[]
  confidence?: number
}

export interface CommandLogEntry {
  id: number
  text: string
  action: string
  target?: LayerId | 'drums' | 'pattern'
  summary: string
  plan?: CommandLogPlanMetadata
}

export interface LoopSnapshot {
  bpm: number
  layers: Record<LayerId, LoopLayer>
  pattern: LiveCodePattern
  liveCode: string
  pendingPatch?: PendingMusicPatch
}

export interface LoopState {
  bpm: number
  layers: Record<LayerId, LoopLayer>
  pattern: LiveCodePattern
  liveCode: string
  commandLog: CommandLogEntry[]
  pendingPatch?: PendingMusicPatch
  history: LoopSnapshot[]
}

export function createInitialLoopState(): LoopState {
  const pattern = createHousePattern()
  return {
    bpm: pattern.bpm,
    layers: {
      kick: { id: 'kick', label: 'Kick', enabled: false, volume: 0.85, complexity: 0.25 },
      snare: { id: 'snare', label: 'Snare', enabled: false, volume: 0.68, complexity: 0.25 },
      hats: {
        id: 'hats',
        label: 'Hats',
        enabled: false,
        volume: 0.48,
        complexity: 0.25,
        subdivision: '8n',
      },
      bass: { id: 'bass', label: 'Bass', enabled: false, volume: 0.72, complexity: 0.35 },
      pad: { id: 'pad', label: 'Pad', enabled: false, volume: 0.42, complexity: 0.25 },
      lead: { id: 'lead', label: 'Lead', enabled: false, volume: 0.34, complexity: 0.3 },
      texture: { id: 'texture', label: 'Texture', enabled: false, volume: 0.28, complexity: 0.22 },
      fx: { id: 'fx', label: 'FX', enabled: false, volume: 0.42, complexity: 0.35 },
    },
    pattern,
    liveCode: patternToLiveCode(pattern),
    commandLog: [],
    history: [],
  }
}

function withLog(
  state: LoopState,
  text: string,
  action: string,
  summary: string,
  target?: CommandLogEntry['target'],
): LoopState {
  return {
    ...state,
    commandLog: [{ id: Date.now(), text, action, target, summary }, ...state.commandLog].slice(0, 8),
  }
}

function setLayer(state: LoopState, layerId: LayerId, patch: Partial<LoopLayer>): LoopState {
  return {
    ...state,
    layers: {
      ...state.layers,
      [layerId]: { ...state.layers[layerId], ...patch },
    },
  }
}

function withHistory(state: LoopState): LoopState {
  return { ...state, history: [...state.history, snapshotLoopState(state)].slice(-12) }
}

function undoLast(state: LoopState, text: string): LoopState {
  const snapshot = state.history[state.history.length - 1]
  if (!snapshot) return withLog(state, text, 'ignored', '되돌릴 이전 상태가 없어요')
  return withLog(
    {
      ...state,
      bpm: snapshot.bpm,
      layers: snapshot.layers,
      pattern: snapshot.pattern,
      liveCode: snapshot.liveCode,
      pendingPatch: undefined,
      history: state.history.slice(0, -1),
    },
    text,
    'undo',
    '직전 변경을 되돌렸어요',
  )
}

function patchPattern(state: LoopState, text: string): LoopState {
  const pattern = mockLiveCodeCommand(text)
  const current = withHistory(state)
  const next: LoopState = {
    ...current,
    bpm: pattern.bpm,
    pattern,
    liveCode: patternToLiveCode(pattern),
    layers: {
      ...current.layers,
      kick: { ...current.layers.kick, enabled: true },
      snare: { ...current.layers.snare, enabled: true },
      hats: { ...current.layers.hats, enabled: true, complexity: pattern.layers.drums.swing > 0.55 ? 0.75 : 0.45, subdivision: '16n' },
      bass: { ...current.layers.bass, enabled: true },
    },
  }
  return withLog(next, text, 'live_code_patch', `${pattern.name} 패턴을 생성해서 얹었어요`, 'pattern')
}

function firstNumber(text: string): number | undefined {
  const match = text.match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : undefined
}

function parseLayerTarget(text: string): LayerId | undefined {
  if (text.includes('킥') || text.includes('kick')) return 'kick'
  if (text.includes('스네어') || text.includes('클랩') || text.includes('snare') || text.includes('clap')) return 'snare'
  if (text.includes('하이햇') || text.includes('햇') || text.includes('hat')) return 'hats'
  if (text.includes('베이스') || text.includes('bass')) return 'bass'
  if (text.includes('패드') || text.includes('pad')) return 'pad'
  if (text.includes('리드') || text.includes('멜로디') || text.includes('아르페지오') || text.includes('arp') || text.includes('lead')) return 'lead'
  if (text.includes('텍스처') || text.includes('질감') || text.includes('공기') || text.includes('노이즈') || text.includes('texture') || text.includes('atmosphere')) return 'texture'
  if (text.includes('fx') || text.includes('효과') || text.includes('전환') || text.includes('빌드업') || text.includes('라이저') || text.includes('riser') || text.includes('스윕') || text.includes('sweep')) return 'fx'
  return undefined
}

function parseLiveParamAction(text: string): LiveAction | undefined {
  const normalized = text.toLowerCase()
  const number = firstNumber(normalized)

  if (normalized.includes('bpm') || normalized.includes('템포') || normalized.includes('빠르')) {
    if (number !== undefined) return { type: 'set_param', target: 'transport', path: 'bpm', value: number, timing: 'next_phrase' }
  }
  if (normalized.includes('스윙') || normalized.includes('swing')) {
    return { type: 'set_param', target: 'transport', path: 'swing', value: number ?? 0.62, timing: 'next_bar' }
  }

  const target = parseLayerTarget(normalized)
  if (!target) return undefined

  const asksToAddLayer = normalized.includes('깔') || normalized.includes('넣') || normalized.includes('얹') || normalized.includes('추가') || normalized.includes('add') || normalized.includes('make')
  const namesExplicitParam =
    normalized.includes('볼륨') ||
    normalized.includes('volume') ||
    normalized.includes('어택') ||
    normalized.includes('attack') ||
    normalized.includes('릴리즈') ||
    normalized.includes('release') ||
    normalized.includes('리버브') ||
    normalized.includes('reverb') ||
    normalized.includes('파형') ||
    normalized.includes('oscillator')
  if (asksToAddLayer && !namesExplicitParam) return undefined

  if (normalized.includes('볼륨') || normalized.includes('volume') || normalized.includes('크게') || normalized.includes('작게')) {
    if (number !== undefined) return { type: 'set_param', target, path: 'volume', value: number > 1 ? number / 100 : number, timing: 'now' }
    return { type: 'mod_param', target, path: 'volume', delta: normalized.includes('작게') || normalized.includes('줄') ? -0.12 : 0.12, timing: 'now' }
  }
  if (normalized.includes('어택') || normalized.includes('attack')) {
    if (number !== undefined) return { type: 'set_param', target, path: 'envelope.attack', value: number, timing: 'next_bar' }
    return { type: 'mod_param', target, path: 'envelope.attack', delta: normalized.includes('짧') ? -0.15 : 0.35, timing: 'next_bar' }
  }
  if (normalized.includes('릴리즈') || normalized.includes('release') || normalized.includes('길게') || normalized.includes('짧게')) {
    const path = normalized.includes('어택') || normalized.includes('attack') ? 'envelope.attack' : 'envelope.release'
    if (number !== undefined) return { type: 'set_param', target, path, value: number, timing: 'next_bar' }
    return { type: 'mod_param', target, path, delta: normalized.includes('짧') ? -0.25 : 0.5, timing: 'next_bar' }
  }
  if (normalized.includes('리버브') || normalized.includes('몽환') || normalized.includes('reverb')) {
    if (number !== undefined) return { type: 'set_param', target, path: 'effect.reverb.wet', value: number > 1 ? number / 100 : number, timing: 'next_bar' }
    return { type: 'mod_param', target, path: 'effect.reverb.wet', delta: normalized.includes('줄') || normalized.includes('덜') ? -0.15 : 0.18, timing: 'next_bar' }
  }
  if (normalized.includes('파형') || normalized.includes('oscillator')) {
    const value = ['sine', 'square', 'sawtooth', 'triangle'].find((item) => normalized.includes(item))
    if (value) return { type: 'set_param', target, path: 'oscillator.type', value, timing: 'next_bar' }
  }

  return undefined
}

export function applyCommand(state: LoopState, rawText: string): LoopState {
  const text = rawText.trim()
  const normalized = text.toLowerCase()
  if (!text) return state

  if (normalized.includes('undo') || normalized.includes('되돌') || normalized.includes('취소')) return undoLast(state, text)

  if (
    normalized.includes('panic') ||
    normalized.includes('패닉') ||
    normalized.includes('비상') ||
    normalized.includes('kill') ||
    normalized.includes('킬')
  ) {
    const current = withHistory(state)
    const next = Object.keys(current.layers).reduce(
      (acc, layerId) => setLayer(acc, layerId as LayerId, { enabled: false }),
      current,
    )
    return withLog({ ...next, pendingPatch: undefined }, text, 'panic', '비상 정지: 모든 소리를 즉시 차단했어요')
  }

  if (normalized.includes('멈춰') || normalized.includes('정지') || normalized.includes('stop') || normalized.includes('스탑')) {
    return withLog({ ...state, pendingPatch: undefined }, text, 'stop', '재생을 정지했어요')
  }

  const liveAction = parseLiveParamAction(text)
  if (liveAction) return applyLiveAction(state, liveAction, text)

  if (
    normalized.includes('하우스') ||
    normalized.includes('house') ||
    normalized.includes('garage') ||
    normalized.includes('개러지') ||
    normalized.includes('uk') ||
    normalized.includes('라이브') ||
    normalized.includes('코딩') ||
    normalized.includes('그루브')
  ) {
    return patchPattern(state, text)
  }

  const deterministicPatches = selectDeterministicPatches(text)
  if (deterministicPatches.length) return applyMusicPatches(state, deterministicPatches, text)

  return withLog({ ...state, pendingPatch: undefined }, text, 'ignored', '아직 live coder가 이해하지 못한 명령이에요')
}
