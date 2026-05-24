import { describe, expect, it } from 'vitest'
import { musicPatchesFromArrangementPlan } from './arrangementPlan'
import { applyMusicPatches } from './musicPatch'
import { createInitialLoopState } from './loopState'
import { isPatchSupported } from './instrumentCapabilities'
import type { ArrangementPlan } from './arrangementPlan'

const tensionCutPlan: ArrangementPlan = {
  intent: 'transition',
  timing: 'next_phrase',
  summary: 'Tone.js knowledge-assisted parameterized arrangement plan',
  preserve: ['bass', 'kick'],
  knowledge_entry_ids: ['noise-fx-gestures'],
  confidence: 0.68,
  patches: [
    {
      target: 'fx',
      reason: 'generated safe FX shape, PatternDSL events, and automation curves',
      operations: [
        { type: 'set_enabled', value: true },
        { type: 'set_volume', value: 0.47 },
        { type: 'set_complexity', value: 0.82 },
        { type: 'set_macro', name: 'filterCutoff', value: 7600 },
        { type: 'set_macro', name: 'reverbWet', value: 0.28 },
        { type: 'set_macro', name: 'delayWet', value: 0.26 },
        { type: 'set_macro', name: 'release', value: 0.16 },
        {
          type: 'set_pattern_events',
          value: [
            { step: 10, voice: 'fx', velocity: 0.18, length: '16n' },
            { step: 11, voice: 'fx', velocity: 0.26, length: '16n' },
            { step: 12, voice: 'fx', velocity: 0.34, length: '16n' },
          ],
        },
      ],
      shape: { type: 'tension_cut', start_step: 10, end_step: 16, intensity: 0.74, density: 0.82 },
      automation: [{ parameter: 'gate', start_step: 10, end_step: 16, start_value: 0.35, end_value: 0.86, shape: 'rising' }],
    },
  ],
}

describe('ArrangementPlan frontend bridge', () => {
  it('converts parameterized FX plans into supported MusicPatch data without preset selection', () => {
    const patches = musicPatchesFromArrangementPlan(tensionCutPlan)

    expect(patches).toHaveLength(1)
    expect(patches[0]).toMatchObject({ target: 'fx', timing: 'next_phrase' })
    expect(patches[0].operations).toContainEqual({ type: 'set_macro', name: 'filterCutoff', value: 7600 })
    expect(patches[0].operations).not.toContainEqual(expect.objectContaining({ type: 'set_macro', name: 'preset' }))
    expect(patches[0].operations).toContainEqual(expect.objectContaining({ type: 'set_pattern_events' }))
    expect(isPatchSupported(patches[0])).toBe(true)
  })

  it('applies generated FX PatternDSL events into LoopState pattern layer', () => {
    const state = createInitialLoopState()
    const patches = musicPatchesFromArrangementPlan(tensionCutPlan)
    const next = applyMusicPatches(state, patches, '드랍 전에 숨 한번 참는 느낌으로 잘라줘')

    expect(next.layers.fx.enabled).toBe(true)
    expect(next.layers.fx.macros?.filterCutoff).toBe(7600)
    expect(next.layers.fx.macros?.preset).toBeUndefined()
    expect(next.pattern.layers.fx.events.map((event) => event.step)).toEqual([10, 11, 12])
    expect(next.pattern.layers.fx.automation?.[0]).toMatchObject({ parameter: 'gate', start_step: 10, end_step: 16, shape: 'rising' })
    expect(next.pendingPatch?.timing).toBe('next_phrase')
  })
})
