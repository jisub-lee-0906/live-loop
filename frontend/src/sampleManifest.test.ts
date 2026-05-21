import { describe, expect, it } from 'vitest'
import { drumSamples, getDrumSampleUrl } from './sampleManifest'

describe('sample manifest', () => {
  it('exposes the core drum sample urls', () => {
    expect(drumSamples.kick).toBe('/samples/drums/kick_01.wav')
    expect(drumSamples.snare).toBe('/samples/drums/snare_01.wav')
    expect(drumSamples.hat).toBe('/samples/drums/hat_closed_01.wav')
  })

  it('returns a stable url by drum sample id', () => {
    expect(getDrumSampleUrl('kick')).toBe('/samples/drums/kick_01.wav')
  })
})
