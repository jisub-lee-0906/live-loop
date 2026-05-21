import { createHousePattern, mockLiveCodeCommand, patternToLiveCode, type LiveCodePattern } from './patternDsl'

export type LayerId = 'kick' | 'snare' | 'hats' | 'bass' | 'pad'

export type Subdivision = '8n' | '16n'

export interface LoopLayer {
  id: LayerId
  label: string
  enabled: boolean
  volume: number
  complexity: number
  subdivision?: Subdivision
}

export interface CommandLogEntry {
  id: number
  text: string
  action: string
  target?: LayerId | 'drums' | 'pattern'
  summary: string
}

export interface LoopState {
  bpm: number
  layers: Record<LayerId, LoopLayer>
  pattern: LiveCodePattern
  liveCode: string
  commandLog: CommandLogEntry[]
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
    },
    pattern,
    liveCode: patternToLiveCode(pattern),
    commandLog: [],
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

function addLayer(state: LoopState, text: string, layerId: LayerId): LoopState {
  const next = setLayer(state, layerId, { enabled: true })
  return withLog(next, text, 'add_layer', `${next.layers[layerId].label} 레이어를 켰어요`, layerId)
}

function patchPattern(state: LoopState, text: string): LoopState {
  const pattern = mockLiveCodeCommand(text)
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
      bass: { ...state.layers.bass, enabled: true },
    },
  }
  return withLog(next, text, 'live_code_patch', `${pattern.name} 패턴을 생성해서 얹었어요`, 'pattern')
}

export function applyCommand(state: LoopState, rawText: string): LoopState {
  const text = rawText.trim()
  const normalized = text.toLowerCase()
  if (!text) return state

  if (normalized.includes('panic') || normalized.includes('멈춰') || normalized.includes('정지')) {
    const next = Object.keys(state.layers).reduce(
      (current, layerId) => setLayer(current, layerId as LayerId, { enabled: false }),
      state,
    )
    return withLog(next, text, 'panic', '모든 레이어를 껐어요')
  }

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

  if (normalized.includes('킥') || normalized.includes('kick')) {
    return addLayer(state, text, 'kick')
  }

  if (normalized.includes('스네어') || normalized.includes('클랩') || normalized.includes('snare')) {
    return addLayer(state, text, 'snare')
  }

  if (normalized.includes('하이햇') || normalized.includes('햇') || normalized.includes('hat')) {
    return addLayer(state, text, 'hats')
  }

  if (normalized.includes('베이스') || normalized.includes('bass')) {
    if (normalized.includes('빼') || normalized.includes('꺼') || normalized.includes('mute')) {
      const next = setLayer(state, 'bass', { enabled: false })
      return withLog(next, text, 'mute_layer', '베이스를 잠깐 뺐어요', 'bass')
    }
    return addLayer(state, text, 'bass')
  }

  if (normalized.includes('패드') || normalized.includes('pad') || normalized.includes('몽환')) {
    return addLayer(state, text, 'pad')
  }

  if (
    normalized.includes('쪼개') ||
    normalized.includes('잘게') ||
    normalized.includes('복잡') ||
    normalized.includes('complex') ||
    normalized.includes('busy')
  ) {
    return patchPattern(state, `${text} uk garage`)
  }

  return withLog(state, text, 'ignored', '아직 live coder가 이해하지 못한 명령이에요')
}
