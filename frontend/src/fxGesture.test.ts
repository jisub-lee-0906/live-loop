import { describe, expect, it } from 'vitest'
import type { FxRuntimeParams } from './audioRuntimeParams'
import { resolveAutomationValueAtStep, resolveFxGesturePlayback } from './fxGesture'

const baseFx: FxRuntimeParams = {
  kind: 'fx',
  preset: 'default',
  filterCutoff: 7600,
  attack: 0.02,
  release: 0.45,
  reverbWet: 0.24,
  delayWet: 0.08,
  volumeScale: 1,
}

describe('FX gesture playback shaping', () => {
  it('plays generated FX PatternDSL events without requiring a preset gate', () => {
    const playback = resolveFxGesturePlayback({ step: 10, voice: 'fx', velocity: 0.3, length: '16n' }, baseFx)

    expect(playback.filterStart).toBeLessThan(playback.filterEnd)
    expect(playback.filterEnd).toBe(7600)
    expect(playback.length).toBe('16n')
  })

  it('derives drop-impact shape from macro timing values, not preset name', () => {
    const playback = resolveFxGesturePlayback(
      { step: 0, voice: 'fx', velocity: 0.54, length: '4n' },
      { ...baseFx, preset: 'anything', filterCutoff: 2400, attack: 0.004, release: 2.2 },
    )

    expect(playback.filterStart).toBe(2400)
    expect(playback.filterEnd).toBeLessThan(900)
    expect(playback.length).toBe('4n')
  })

  it('derives delay-throw and stutter shapes from macros', () => {
    const throwFx = resolveFxGesturePlayback({ step: 15, voice: 'fx', velocity: 0.42, length: '16n' }, { ...baseFx, delayWet: 0.52 })
    const stutter = resolveFxGesturePlayback({ step: 12, voice: 'fx', velocity: 0.22, length: '16n' }, { ...baseFx, release: 0.16 })

    expect(throwFx.rampSeconds).toBe(0.12)
    expect(stutter.rampSeconds).toBe(0)
    expect(stutter.length).toBe('16n')
  })

  it('evaluates generated automation curves at pattern-event steps', () => {
    const value = resolveAutomationValueAtStep(
      [{ parameter: 'gate', start_step: 10, end_step: 16, start_value: 0.35, end_value: 0.86, shape: 'rising' }],
      'gate',
      13,
      1,
    )

    expect(value).toBeGreaterThan(0.35)
    expect(value).toBeLessThan(0.86)
  })
})
