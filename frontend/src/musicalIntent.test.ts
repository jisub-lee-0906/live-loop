import { describe, expect, it } from 'vitest'
import { applyMusicalIntentCommand, applyMusicalIntentDelta, createDefaultMusicalIntentState, interpretMusicalIntentCommand } from './musicalIntent'

describe('musical intent state', () => {
  it('starts from a neutral empty-loop conducting state', () => {
    expect(createDefaultMusicalIntentState()).toEqual({
      energy: 0,
      tension: 0,
      density: 0,
      space: 0.35,
      promise: 0,
      focus: 'silence',
    })
  })

  it('clamps numeric deltas so intent state stays performance-safe', () => {
    const state = createDefaultMusicalIntentState()
    const next = applyMusicalIntentDelta(state, {
      gesture: 'drive',
      energy_delta: 2,
      tension_delta: -2,
      density_delta: 1.5,
      space_delta: -1,
      promise_delta: 3,
      focus: 'drums',
      time_horizon: 'next_bar',
      preserve: ['kick'],
      avoid: [],
    })

    expect(next).toMatchObject({ energy: 1, tension: 0, density: 1, space: 0, promise: 1, focus: 'drums' })
  })

  it('interprets withhold commands as silence-focused tension and promise', () => {
    const intent = interpretMusicalIntentCommand('아직 터뜨리지 말고 숨 참아')

    expect(intent).toMatchObject({
      gesture: 'withhold_release',
      focus: 'silence',
      time_horizon: 'one_phrase',
    })
    expect(intent.tension_delta).toBeGreaterThan(0)
    expect(intent.promise_delta).toBeGreaterThan(0)
    expect(intent.density_delta).toBeLessThan(0)
    expect(intent.preserve).toContain('kick')
    expect(intent.preserve).toContain('bass')
    expect(intent.avoid).toContain('new_lead')
  })

  it('interprets release commands as a promised drop/release gesture', () => {
    const base = applyMusicalIntentCommand(createDefaultMusicalIntentState(), '아직 터뜨리지 마')
    const released = applyMusicalIntentCommand(base, '이제 터뜨려')

    expect(released.focus).toBe('fx')
    expect(released.energy).toBeGreaterThan(base.energy)
    expect(released.density).toBeGreaterThan(base.density)
    expect(released.promise).toBeLessThan(base.promise)
  })

  it('interprets memory and recall commands without pretending they are note generation', () => {
    expect(interpretMusicalIntentCommand('방금 베이스 기억해')).toMatchObject({ gesture: 'remember_motif', focus: 'bass' })
    expect(interpretMusicalIntentCommand('아까 그 느낌 다시 불러')).toMatchObject({ gesture: 'recall_motif', time_horizon: 'next_bar' })
  })
})
