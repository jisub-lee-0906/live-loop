import { describe, expect, it } from 'vitest'
import { applyCommand, createInitialLoopState } from './loopState'

describe('loop command state', () => {
  it('adds a kick layer from Korean text', () => {
    const state = applyCommand(createInitialLoopState(), '킥 깔아줘')

    expect(state.layers.kick.enabled).toBe(true)
    expect(state.commandLog[0]?.action).toBe('add_layer')
  })

  it('adds hats and increases drum complexity from Korean text', () => {
    const withHats = applyCommand(createInitialLoopState(), '하이햇 얹어줘')
    const busier = applyCommand(withHats, '드럼 비트 좀 더 쪼개줘')

    expect(busier.layers.hats.enabled).toBe(true)
    expect(busier.layers.hats.complexity).toBeGreaterThan(withHats.layers.hats.complexity)
    expect(busier.layers.hats.subdivision).toBe('16n')
  })

  it('mutes and unmutes bass without deleting the layer', () => {
    const withBass = applyCommand(createInitialLoopState(), '베이스 넣어줘')
    const muted = applyCommand(withBass, '베이스 빼줘')
    const unmuted = applyCommand(muted, '베이스 다시 켜줘')

    expect(muted.layers.bass.enabled).toBe(false)
    expect(unmuted.layers.bass.enabled).toBe(true)
    expect(unmuted.layers.bass.volume).toBe(withBass.layers.bass.volume)
  })

  it('records unsupported commands as ignored log entries', () => {
    const state = applyCommand(createInitialLoopState(), '완전히 새로운 장르로 천천히 바꿔줘')

    expect(state.commandLog[0]?.action).toBe('ignored')
    expect(state.layers.kick.enabled).toBe(false)
  })
})
