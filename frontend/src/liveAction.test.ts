import { describe, expect, it } from 'vitest'
import { createInitialLoopState } from './loopState'
import { applyLiveAction, liveParamRegistry, validateLiveAction } from './liveAction'

describe('LiveAction param registry and reducer', () => {
  it('validates known Tone-safe parameter paths and rejects unknown raw paths', () => {
    expect(liveParamRegistry['pad.envelope.attack']).toMatchObject({ target: 'pad', valueType: 'number', min: 0.001, max: 4 })

    expect(validateLiveAction({ type: 'set_param', target: 'pad', path: 'envelope.attack', value: 0.9, timing: 'now' })).toMatchObject({
      ok: true,
      action: { timing: 'next_bar', value: 0.9 },
    })
    expect(validateLiveAction({ type: 'set_param', target: 'pad', path: 'oscillator.hack', value: 'sawtooth', timing: 'now' })).toMatchObject({
      ok: false,
      reason: 'unsupported_param',
    })
  })

  it('clamps numeric parameter edits and stores them as validated layer macros', () => {
    const state = createInitialLoopState()
    const next = applyLiveAction(state, { type: 'set_param', target: 'pad', path: 'envelope.attack', value: 99, timing: 'now' }, '패드 어택 길게')

    expect(next.layers.pad.macros?.attack).toBe(4)
    expect(next.pendingPatch).toMatchObject({ id: 'live-param-pad-envelope.attack', target: 'pad', timing: 'next_bar' })
    expect(next.commandLog[0]).toMatchObject({ action: 'live_action', target: 'pad' })
    expect(next.history).toHaveLength(1)
  })

  it('supports relative edits from the current audible runtime defaults', () => {
    const state = createInitialLoopState()
    const louder = applyLiveAction(state, { type: 'mod_param', target: 'bass', path: 'volume', delta: 0.5, timing: 'now' }, '베이스 키워')
    const wetter = applyLiveAction(louder, { type: 'mod_param', target: 'pad', path: 'effect.reverb.wet', delta: 0.2, timing: 'now' }, '더 몽환적으로')
    const longerRelease = applyLiveAction(wetter, { type: 'mod_param', target: 'pad', path: 'envelope.release', delta: 0.5, timing: 'next_bar' }, '패드 릴리즈 길게')

    expect(louder.layers.bass.volume).toBe(1)
    expect(wetter.layers.pad.macros?.reverbWet).toBeCloseTo(0.48)
    expect(longerRelease.layers.pad.macros?.release).toBeCloseTo(2.7)
  })

  it('rejects registry paths that are not wired to the runtime audio engine yet', () => {
    const state = createInitialLoopState()
    const osc = applyLiveAction(state, { type: 'set_param', target: 'pad', path: 'oscillator.type', value: 'sawtooth', timing: 'next_bar' }, '패드 파형 sawtooth')
    const bassEnvelope = applyLiveAction(state, { type: 'set_param', target: 'bass', path: 'envelope.attack', value: 0.4, timing: 'next_bar' }, '베이스 어택 길게')

    expect(osc.commandLog[0]).toMatchObject({ action: 'rejected_live_action' })
    expect(bassEnvelope.commandLog[0]).toMatchObject({ action: 'rejected_live_action' })
    expect(osc.layers.pad.macros?.oscillatorType).toBeUndefined()
    expect(bassEnvelope.layers.bass.macros?.attack).toBeUndefined()
  })

  it('applies transport bpm and swing with safe timing policy', () => {
    const state = createInitialLoopState()
    const faster = applyLiveAction(state, { type: 'set_param', target: 'transport', path: 'bpm', value: 300, timing: 'now' }, '빠르게')
    const swung = applyLiveAction(faster, { type: 'set_param', target: 'transport', path: 'swing', value: 0.9, timing: 'now' }, '스윙 더')

    expect(faster.bpm).toBe(180)
    expect(faster.pendingPatch).toMatchObject({ timing: 'next_phrase' })
    expect(swung.pattern.layers.drums.swing).toBe(0.75)
    expect(swung.liveCode).toContain('swing 0.75')
  })

  it('rejects unsafe transport position edits unless explicitly supported later', () => {
    const state = createInitialLoopState()
    const next = applyLiveAction(state, { type: 'set_param', target: 'transport', path: 'position', value: '2:0:0', timing: 'now' }, '2마디로 점프')

    expect(next).not.toBe(state)
    expect(next.commandLog[0]).toMatchObject({ action: 'rejected_live_action', target: 'pattern' })
    expect(next.bpm).toBe(state.bpm)
  })
})
