import { describe, expect, it } from 'vitest'
import { applyMusicPatch } from './musicPatch'
import { getInstrumentCapability, isPatchSupported } from './instrumentCapabilities'
import { createInitialLoopState } from './loopState'
import type { MusicPatch } from './musicPatch'

describe('MusicPatch reducer', () => {
  it('applies a verified layer macro without executing generated code', () => {
    const state = createInitialLoopState()
    const patch: MusicPatch = {
      id: 'bass-dark-sub-v0',
      label: 'Dark sub bass',
      target: 'bass',
      timing: 'next_bar',
      operations: [
        { type: 'set_enabled', value: true },
        { type: 'set_macro', name: 'preset', value: 'dark_sub' },
        { type: 'set_macro', name: 'filterCutoff', value: 420 },
        { type: 'set_volume', value: 0.78 },
      ],
    }

    const next = applyMusicPatch(state, patch, '어두운 베이스 넣어줘')

    expect(next.layers.bass.enabled).toBe(true)
    expect(next.layers.bass.volume).toBe(0.78)
    expect(next.layers.bass.macros).toEqual({ preset: 'dark_sub', filterCutoff: 420 })
    expect(next.pendingPatch?.id).toBe('bass-dark-sub-v0')
    expect(next.pendingPatch?.timing).toBe('next_bar')
    expect(next.commandLog[0]).toMatchObject({ action: 'music_patch', target: 'bass' })
  })

  it('rejects unsupported patch operations before mutating loop state', () => {
    const state = createInitialLoopState()
    const patch: MusicPatch = {
      id: 'kick-illegal-reverb-v0',
      label: 'Illegal kick reverb',
      target: 'kick',
      timing: 'next_bar',
      operations: [{ type: 'set_macro', name: 'reverbWet', value: 0.8 }],
    }

    expect(isPatchSupported(patch)).toBe(false)
    const next = applyMusicPatch(state, patch, '킥에 리버브 많이')

    expect(next.layers.kick).toEqual(state.layers.kick)
    expect(next.commandLog[0]).toMatchObject({ action: 'rejected_patch', target: 'kick' })
  })

  it('rejects macro values with wrong types or unsafe ranges', () => {
    const invalidSubOsc: MusicPatch = {
      id: 'bass-invalid-subosc-v0',
      label: 'Invalid sub oscillator',
      target: 'bass',
      timing: 'next_bar',
      operations: [{ type: 'set_macro', name: 'subOsc', value: 'true' }],
    }
    const invalidCutoff: MusicPatch = {
      id: 'bass-invalid-cutoff-v0',
      label: 'Invalid cutoff',
      target: 'bass',
      timing: 'next_bar',
      operations: [{ type: 'set_macro', name: 'filterCutoff', value: 40 }],
    }
    const invalidPadRelease: MusicPatch = {
      id: 'pad-invalid-release-v0',
      label: 'Invalid pad release',
      target: 'pad',
      timing: 'next_bar',
      operations: [{ type: 'set_macro', name: 'release', value: 12 }],
    }

    expect(isPatchSupported(invalidSubOsc)).toBe(false)
    expect(isPatchSupported(invalidCutoff)).toBe(false)
    expect(isPatchSupported(invalidPadRelease)).toBe(false)
  })

  it('documents instrument capability boundaries for the LLM patch selector', () => {
    const bass = getInstrumentCapability('bass')
    const kick = getInstrumentCapability('kick')

    expect(bass.macros).toContain('filterCutoff')
    expect(bass.presets).toContain('dark_sub')
    expect(kick.macros).not.toContain('filterCutoff')
    expect(kick.operations).toContain('set_enabled')
  })
})
