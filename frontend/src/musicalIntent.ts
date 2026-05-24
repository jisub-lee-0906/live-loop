export type MusicalFocus = 'drums' | 'bass' | 'lead' | 'texture' | 'fx' | 'silence'
export type MusicalGesture =
  | 'drive'
  | 'carve_space'
  | 'wait'
  | 'withhold_release'
  | 'release'
  | 'vary'
  | 'remember_motif'
  | 'recall_motif'
  | 'space_shift'
  | 'unknown'
export type MusicalTimeHorizon = 'next_bar' | 'one_phrase' | 'two_phrases' | 'eight_bars'
export type MusicalAnchor = 'kick' | 'bass' | 'drums' | 'lead' | 'texture' | 'fx'

export interface MusicalIntentState {
  energy: number
  tension: number
  density: number
  space: number
  promise: number
  focus: MusicalFocus
}

export interface MusicalIntentDelta {
  gesture: MusicalGesture
  energy_delta: number
  tension_delta: number
  density_delta: number
  space_delta: number
  promise_delta: number
  focus: MusicalFocus
  time_horizon: MusicalTimeHorizon
  preserve: MusicalAnchor[]
  avoid: string[]
}

export function createDefaultMusicalIntentState(): MusicalIntentState {
  return {
    energy: 0,
    tension: 0,
    density: 0,
    space: 0.35,
    promise: 0,
    focus: 'silence',
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

export function applyMusicalIntentDelta(state: MusicalIntentState, delta: MusicalIntentDelta): MusicalIntentState {
  return {
    energy: clamp01(state.energy + delta.energy_delta),
    tension: clamp01(state.tension + delta.tension_delta),
    density: clamp01(state.density + delta.density_delta),
    space: clamp01(state.space + delta.space_delta),
    promise: clamp01(state.promise + delta.promise_delta),
    focus: delta.focus,
  }
}

function delta(overrides: Partial<MusicalIntentDelta>): MusicalIntentDelta {
  const base: MusicalIntentDelta = {
    gesture: 'unknown',
    energy_delta: 0,
    tension_delta: 0,
    density_delta: 0,
    space_delta: 0,
    promise_delta: 0,
    focus: 'silence',
    time_horizon: 'next_bar',
    preserve: ['kick'],
    avoid: [],
  }
  return {
    ...base,
    ...overrides,
    preserve: unique(overrides.preserve ?? base.preserve),
    avoid: unique(overrides.avoid ?? base.avoid),
  }
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word))
}

function targetFocusFromText(text: string): MusicalFocus {
  if (hasAny(text, ['베이스', 'bass'])) return 'bass'
  if (hasAny(text, ['리드', '멜로디', 'lead'])) return 'lead'
  if (hasAny(text, ['텍스처', '질감', '공기', 'texture'])) return 'texture'
  if (hasAny(text, ['fx', '효과', '전환', '드랍', 'drop'])) return 'fx'
  if (hasAny(text, ['드럼', '하이햇', '햇', '킥', 'drum', 'hat', 'kick'])) return 'drums'
  return 'silence'
}

export function interpretMusicalIntentCommand(rawText: string): MusicalIntentDelta {
  const text = rawText.trim().toLowerCase()
  const focus = targetFocusFromText(text)

  if (hasAny(text, ['기억', 'remember'])) {
    return delta({ gesture: 'remember_motif', focus, time_horizon: 'next_bar', preserve: ['kick', 'bass'] })
  }

  if (hasAny(text, ['다시 불러', '불러', '아까', 'recall'])) {
    return delta({ gesture: 'recall_motif', focus, time_horizon: 'next_bar', preserve: ['kick', 'bass'], promise_delta: -0.2 })
  }

  if (hasAny(text, ['이제 터뜨', '터뜨려', '풀어', '돌아와', 'release', 'drop'])) {
    return delta({
      gesture: 'release',
      focus: 'fx',
      time_horizon: 'next_bar',
      energy_delta: 0.35,
      tension_delta: -0.3,
      density_delta: 0.28,
      space_delta: -0.08,
      promise_delta: -0.55,
      preserve: ['kick', 'bass'],
    })
  }

  if (hasAny(text, ['아직 터뜨리지', '숨 참', '참아', 'hold', 'withhold'])) {
    return delta({
      gesture: 'withhold_release',
      focus: 'silence',
      time_horizon: 'one_phrase',
      energy_delta: -0.08,
      tension_delta: 0.38,
      density_delta: -0.22,
      space_delta: 0.18,
      promise_delta: 0.42,
      preserve: ['kick', 'bass'],
      avoid: ['new_lead', 'impact'],
    })
  }

  if (hasAny(text, ['비워', '덜어', '빼고', 'empty', 'carve'])) {
    return delta({ gesture: 'carve_space', focus: 'silence', density_delta: -0.35, space_delta: 0.28, energy_delta: -0.18, preserve: ['kick'] })
  }

  if (hasAny(text, ['기다려', 'wait', '아직 들어오지'])) {
    return delta({ gesture: 'wait', focus: 'silence', time_horizon: 'one_phrase', density_delta: -0.25, tension_delta: 0.16, promise_delta: 0.18, preserve: ['kick', 'bass'], avoid: ['new_lead'] })
  }

  if (hasAny(text, ['몰아', '더 가', 'drive', 'busy', '쪼개'])) {
    return delta({ gesture: 'drive', focus: 'drums', energy_delta: 0.24, density_delta: 0.22, tension_delta: 0.08, preserve: ['kick', 'bass'] })
  }

  if (hasAny(text, ['다른 느낌', '변주', '덜 뻔', '반만 말', 'variation', 'different'])) {
    return delta({ gesture: 'vary', focus: focus === 'silence' ? 'lead' : focus, density_delta: text.includes('반만') ? -0.2 : 0.05, preserve: ['kick', 'bass'] })
  }

  if (hasAny(text, ['멀어', '가까', '공간', 'space', 'wide', 'dry', '건조'])) {
    const far = hasAny(text, ['멀어', '공간', 'space', 'wide'])
    return delta({ gesture: 'space_shift', focus: 'texture', space_delta: far ? 0.25 : -0.2, density_delta: far ? -0.08 : 0, preserve: ['kick', 'bass'] })
  }

  return delta({ gesture: 'unknown', focus })
}

export function applyMusicalIntentCommand(state: MusicalIntentState, rawText: string): MusicalIntentState {
  return applyMusicalIntentDelta(state, interpretMusicalIntentCommand(rawText))
}
