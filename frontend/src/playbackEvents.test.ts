import { describe, expect, it } from 'vitest'
import { applyCommand, createInitialLoopState } from './loopState'
import { resolvePlaybackStepEvents } from './playbackEvents'

describe('playback event resolution', () => {
  it('keeps default house hats sparse before the hats layer is enabled', () => {
    const state = createInitialLoopState()

    expect(resolvePlaybackStepEvents(state, 0).filter((event) => event.voice === 'hat')).toHaveLength(0)
    expect(resolvePlaybackStepEvents(state, 1).filter((event) => event.voice === 'hat')).toHaveLength(1)
  })

  it('turns a verified 16n hats patch into audible supplemental hat events', () => {
    const state = applyCommand(createInitialLoopState(), '하이햇 얹어줘')

    expect(state.layers.hats.subdivision).toBe('16n')
    expect(resolvePlaybackStepEvents(state, 0).some((event) => event.voice === 'hat')).toBe(true)
    expect(resolvePlaybackStepEvents(state, 2).some((event) => event.voice === 'hat')).toBe(true)
    expect(resolvePlaybackStepEvents(state, 1).filter((event) => event.voice === 'hat')).toHaveLength(1)
  })
})
