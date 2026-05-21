import { describe, expect, it } from 'vitest'
import { shouldTriggerHat, shouldTriggerKick, shouldTriggerSnare } from './drumPatterns'

describe('drum pattern helpers', () => {
  it('keeps kick stable at low complexity', () => {
    expect([0, 4, 8, 12].every((step) => shouldTriggerKick(step, 0.2))).toBe(true)
    expect(shouldTriggerKick(3, 0.2)).toBe(false)
  })

  it('adds syncopated kick hits at high complexity', () => {
    expect(shouldTriggerKick(6, 0.8)).toBe(true)
    expect(shouldTriggerKick(14, 0.8)).toBe(true)
  })

  it('plays snare on backbeats and adds ghosts when complex', () => {
    expect(shouldTriggerSnare(4, 0.2)).toEqual({ hit: true, accent: 1 })
    expect(shouldTriggerSnare(12, 0.2)).toEqual({ hit: true, accent: 1 })
    expect(shouldTriggerSnare(3, 0.65)).toEqual({ hit: true, accent: 0.35 })
  })

  it('switches hats from eighths to sixteenths as complexity rises', () => {
    expect(shouldTriggerHat(2, 0.25)).toBe(true)
    expect(shouldTriggerHat(1, 0.25)).toBe(false)
    expect(shouldTriggerHat(1, 0.6)).toBe(true)
  })
})
