import { describe, expect, it } from 'vitest'
import { applyCommand, createInitialLoopState } from './loopState'
import { resolveLayerRuntimeParams, resolveRuntimeParams } from './audioRuntimeParams'

describe('audio runtime params from MusicPatch macros', () => {
  it('maps dark sub bass patch macros to Tone-safe bass parameters', () => {
    const state = applyCommand(createInitialLoopState(), '어두운 베이스 넣어줘')
    const params = resolveLayerRuntimeParams(state.layers.bass)

    expect(params.kind).toBe('bass')
    if (params.kind !== 'bass') throw new Error('expected bass params')
    expect(params.filterCutoff).toBe(420)
    expect(params.resonance).toBe(2.2)
    expect(params.subOsc).toBe(true)
    expect(params.volumeScale).toBeGreaterThan(0.6)
  })

  it('maps pad patch macros to wet reverb and slower attack', () => {
    const state = applyCommand(createInitialLoopState(), '몽환적인 패드 깔아줘')
    const params = resolveLayerRuntimeParams(state.layers.pad)

    expect(params.kind).toBe('pad')
    if (params.kind !== 'pad') throw new Error('expected pad params')
    expect(params.filterCutoff).toBe(1100)
    expect(params.reverbWet).toBe(0.42)
    expect(params.attack).toBe(0.35)
  })

  it('maps hats patch macros and subdivision for busier patterns', () => {
    const state = applyCommand(createInitialLoopState(), '드럼 좀 더 쪼개줘')
    const params = resolveLayerRuntimeParams(state.layers.hats)

    expect(params.kind).toBe('hats')
    if (params.kind !== 'hats') throw new Error('expected hats params')
    expect(params.subdivision).toBe('16n')
    expect(params.release).toBeGreaterThan(0)
    expect(params.brightness).toBeGreaterThan(0.5)
  })

  it('maps lead sparkle patch macros to Tone-safe lead parameters', () => {
    const state = applyCommand(createInitialLoopState(), '위에 반짝이는 아르페지오 살짝')
    const params = resolveLayerRuntimeParams(state.layers.lead)

    expect(params.kind).toBe('lead')
    if (params.kind !== 'lead') throw new Error('expected lead params')
    expect(params.filterCutoff).toBe(5600)
    expect(params.reverbWet).toBe(0.34)
    expect(params.delayWet).toBe(0.28)
  })

  it('maps texture patch macros to Tone-safe noise-bed parameters', () => {
    const state = applyCommand(createInitialLoopState(), '공기감 있는 노이즈 질감 깔아줘')
    const params = resolveLayerRuntimeParams(state.layers.texture)

    expect(params.kind).toBe('texture')
    if (params.kind !== 'texture') throw new Error('expected texture params')
    expect(params.filterCutoff).toBe(2600)
    expect(params.reverbWet).toBe(0.64)
    expect(params.release).toBe(3.8)
  })

  it('maps FX riser macros to Tone-safe transition parameters', () => {
    const state = applyCommand(createInitialLoopState(), '다음 전환 전에 라이저 효과 넣어줘')
    const params = resolveLayerRuntimeParams(state.layers.fx)

    expect(params.kind).toBe('fx')
    if (params.kind !== 'fx') throw new Error('expected fx params')
    expect(params.filterCutoff).toBe(9200)
    expect(params.reverbWet).toBe(0.5)
    expect(params.delayWet).toBe(0.22)
    expect(params.preset).toBe('riser_sweep')
  })

  it('maps expanded FX gesture presets to distinct Tone-safe parameters', () => {
    const impact = resolveLayerRuntimeParams(applyCommand(createInitialLoopState(), '드랍 임팩트 쾅 넣어줘').layers.fx)
    const throwFx = resolveLayerRuntimeParams(applyCommand(createInitialLoopState(), '마지막 소리 딜레이로 던져줘').layers.fx)
    const stutter = resolveLayerRuntimeParams(applyCommand(createInitialLoopState(), '전환 전에 스터터 게이트로 잘라줘').layers.fx)

    expect(impact.kind).toBe('fx')
    expect(throwFx.kind).toBe('fx')
    expect(stutter.kind).toBe('fx')
    if (impact.kind !== 'fx' || throwFx.kind !== 'fx' || stutter.kind !== 'fx') throw new Error('expected fx params')
    expect(impact.preset).toBe('drop_impact')
    expect(impact.release).toBeGreaterThan(1)
    expect(throwFx.preset).toBe('delay_throw')
    expect(throwFx.delayWet).toBeGreaterThan(0.5)
    expect(stutter.preset).toBe('stutter_gate')
    expect(stutter.release).toBeLessThan(0.3)
  })

  it('resolves complete runtime params for the current loop state', () => {
    const withBass = applyCommand(createInitialLoopState(), '어두운 베이스 넣어줘')
    const withPad = applyCommand(withBass, '몽환적인 패드 깔아줘')
    const params = resolveRuntimeParams(withPad)

    expect(params.bass.filterCutoff).toBe(420)
    expect(params.pad.reverbWet).toBe(0.42)
    expect(params.kick.drive).toBeGreaterThanOrEqual(0)
    expect(params.texture.filterCutoff).toBeGreaterThan(0)
    expect(params.fx.filterCutoff).toBeGreaterThan(0)
  })
})
