import { describe, expect, it } from 'vitest'
import { applyCommand, createInitialLoopState } from './loopState'

describe('loop command state', () => {
  it('adds a kick layer from Korean text through a verified patch', () => {
    const state = applyCommand(createInitialLoopState(), '킥 깔아줘')

    expect(state.layers.kick.enabled).toBe(true)
    expect(state.commandLog[0]?.action).toBe('music_patch')
    expect(state.pendingPatch?.id).toBe('kick-tight-four-v0')
  })

  it('adds hats and increases drum complexity from Korean text', () => {
    const withHats = applyCommand(createInitialLoopState(), '하이햇 얹어줘')
    const busier = applyCommand(withHats, '드럼 비트 좀 더 쪼개줘')

    expect(busier.layers.hats.enabled).toBe(true)
    expect(busier.layers.hats.complexity).toBeGreaterThan(withHats.layers.hats.complexity)
    expect(busier.layers.hats.subdivision).toBe('16n')
  })

  it('adds a playable drum groove from a generic drum beat command', () => {
    const state = applyCommand(createInitialLoopState(), '드럼비트 추가해줘')

    expect(state.layers.kick.enabled).toBe(true)
    expect(state.layers.snare.enabled).toBe(true)
    expect(state.layers.hats.enabled).toBe(true)
    expect(state.layers.hats.subdivision).toBe('16n')
    expect(state.commandLog[0]?.action).toBe('music_patch')
  })

  it('mutes a full drum groove from a generic Korean off command', () => {
    const withDrums = applyCommand(createInitialLoopState(), '드럼비트 추가해줘')
    const muted = applyCommand(withDrums, '드럼비트 꺼줘')

    expect(withDrums.layers.kick.enabled).toBe(true)
    expect(withDrums.layers.snare.enabled).toBe(true)
    expect(withDrums.layers.hats.enabled).toBe(true)
    expect(muted.layers.kick.enabled).toBe(false)
    expect(muted.layers.snare.enabled).toBe(false)
    expect(muted.layers.hats.enabled).toBe(false)
    expect(muted.layers.bass.enabled).toBe(false)
    expect(muted.commandLog[0]?.action).toBe('music_patch')
  })

  it('mutes and unmutes bass without deleting the layer', () => {
    const withBass = applyCommand(createInitialLoopState(), '베이스 넣어줘')
    const muted = applyCommand(withBass, '베이스 빼줘')
    const unmuted = applyCommand(muted, '베이스 다시 켜줘')

    expect(muted.layers.bass.enabled).toBe(false)
    expect(unmuted.layers.bass.enabled).toBe(true)
    expect(unmuted.layers.bass.volume).toBe(withBass.layers.bass.volume)
    expect(unmuted.layers.bass.macros).toEqual(withBass.layers.bass.macros)
  })

  it('covers MVP acceptance commands with verified patches and restore paths', () => {
    const withKick = applyCommand(createInitialLoopState(), '킥 깔아줘')
    const withHats = applyCommand(withKick, '하이햇 얹어줘')
    const withBass = applyCommand(withHats, '베이스 둥글게 넣어줘')
    const busier = applyCommand(withBass, '킥은 유지하고 드럼 더 몰아줘')
    const withPad = applyCommand(busier, '패드 넓게 깔아줘')
    const darker = applyCommand(withPad, '전체 좀 어둡게')
    const muted = applyCommand(darker, '베이스 잠깐 빼')
    const dropped = applyCommand(muted, '다시 드랍')

    expect(dropped.layers.kick.enabled).toBe(true)
    expect(dropped.layers.hats.enabled).toBe(true)
    expect(dropped.layers.hats.subdivision).toBe('16n')
    expect(dropped.layers.bass.enabled).toBe(true)
    expect(dropped.layers.pad.enabled).toBe(true)
    expect(dropped.layers.bass.macros?.filterCutoff).toBeLessThanOrEqual(560)
    expect(dropped.layers.pad.macros?.reverbWet).toBeGreaterThanOrEqual(0.5)
    expect(dropped.commandLog[0]?.action).toBe('music_patch')
  })

  it('routes broad parameter commands through LiveAction instead of phrase-specific patches', () => {
    const state = createInitialLoopState()
    const slowerAttack = applyCommand(state, '패드 어택 길게 해줘')
    const faster = applyCommand(slowerAttack, 'bpm 150으로 바꿔')
    const swung = applyCommand(faster, '스윙 0.7로 바꿔')

    expect(slowerAttack.commandLog[0]).toMatchObject({ action: 'live_action', target: 'pad' })
    expect(slowerAttack.layers.pad.macros?.attack).toBeGreaterThan(0)
    expect(faster.bpm).toBe(150)
    expect(faster.pendingPatch).toMatchObject({ timing: 'next_phrase' })
    expect(swung.pattern.layers.drums.swing).toBe(0.7)
  })

  it('undo restores the previous loop snapshot', () => {
    const initial = createInitialLoopState()
    const withKick = applyCommand(initial, '킥 깔아줘')
    const undone = applyCommand(withKick, 'undo')

    expect(withKick.layers.kick.enabled).toBe(true)
    expect(undone.layers.kick.enabled).toBe(false)
    expect(undone.commandLog[0]?.action).toBe('undo')
  })

  it('records unsupported commands as ignored log entries', () => {
    const state = applyCommand(createInitialLoopState(), '완전히 새로운 장르로 천천히 바꿔줘')

    expect(state.commandLog[0]?.action).toBe('ignored')
    expect(state.layers.kick.enabled).toBe(false)
  })

  it('clears stale pending patch timing when a command is ignored or rejected', () => {
    const withPending = applyCommand(createInitialLoopState(), 'bpm 150')
    const ignored = applyCommand(withPending, '알 수 없는 명령')
    const rejected = applyCommand(withPending, '패드 파형 sawtooth')

    expect(withPending.pendingPatch?.timing).toBe('next_phrase')
    expect(ignored.commandLog[0]?.action).toBe('ignored')
    expect(ignored.pendingPatch).toBeUndefined()
    expect(rejected.commandLog[0]?.action).toBe('rejected_live_action')
    expect(rejected.pendingPatch).toBeUndefined()
  })

  it('clears stale pending patch timing for stop, panic, and undo commands', () => {
    const withPending = applyCommand(createInitialLoopState(), 'bpm 150')
    const stopped = applyCommand(withPending, '멈춰')
    const panic = applyCommand(withPending, 'panic')
    const koreanPanic = applyCommand(withPending, '패닉')
    const emergency = applyCommand(withPending, '비상정지')
    const withKick = applyCommand(createInitialLoopState(), '킥 깔아줘')
    const undone = applyCommand(withKick, 'undo')

    expect(stopped.commandLog[0]?.action).toBe('stop')
    expect(stopped.pendingPatch).toBeUndefined()
    expect(panic.commandLog[0]?.action).toBe('panic')
    expect(panic.pendingPatch).toBeUndefined()
    expect(koreanPanic.commandLog[0]?.action).toBe('panic')
    expect(emergency.commandLog[0]?.action).toBe('panic')
    expect(undone.commandLog[0]?.action).toBe('undo')
    expect(undone.pendingPatch).toBeUndefined()
  })
})
