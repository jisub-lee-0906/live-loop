import { describe, expect, it } from 'vitest'
import { createHousePattern, createPatternFromIntent, createUkGaragePattern, patternToLiveCode, resolveStepEvents } from './patternDsl'

describe('live-code pattern DSL', () => {
  it('creates a house pattern with musical drum and bass events', () => {
    const pattern = createHousePattern()

    expect(pattern.name).toContain('House')
    expect(pattern.layers.drums.steps).toBe(16)
    expect(resolveStepEvents(pattern.layers.drums, 0).map((event) => event.voice)).toContain('kick')
    expect(resolveStepEvents(pattern.layers.drums, 4).map((event) => event.voice)).toContain('snare')
    expect(resolveStepEvents(pattern.layers.bass, 2).some((event) => event.note === 'C2')).toBe(true)
  })

  it('creates a shuffled uk garage pattern with off-grid feeling encoded as swing', () => {
    const pattern = createUkGaragePattern()

    expect(pattern.layers.drums.swing).toBeGreaterThan(0.55)
    expect(resolveStepEvents(pattern.layers.drums, 7).some((event) => event.voice === 'kick')).toBe(true)
    expect(resolveStepEvents(pattern.layers.drums, 15).some((event) => event.voice === 'hat')).toBe(true)
  })

  it('renders a readable live-code preview', () => {
    const code = patternToLiveCode(createHousePattern())

    expect(code).toContain('live_loop "house groove"')
    expect(code).toContain('layer "drums"')
    expect(code).toContain('sample kick')
    expect(code).toContain('synth bass_pluck')
  })

  it('composes a pattern from validated local LLM intent', () => {
    const pattern = createPatternFromIntent({
      style: 'uk_garage',
      targets: ['drums', 'bass'],
      constraints: ['shuffle_hats', 'offbeat_bass'],
      timing: 'next_bar',
      confidence: 0.82,
    })

    expect(pattern.id).toBe('ukg-shuffle')
  })
})
