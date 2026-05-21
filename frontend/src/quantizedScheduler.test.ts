import { describe, expect, it } from 'vitest'
import { barDurationMs, classifyQuantization, computeScheduleDecision } from './quantizedScheduler'

const base = { bpm: 120, bar: 1, beat: 1, sixteenth: 1, seconds: 0, isPlaying: true }

describe('quantizedScheduler', () => {
  it('computes 4/4 bar duration from bpm', () => {
    expect(barDurationMs(120)).toBe(2000)
  })

  it('classifies layer additions as next 2-bar boundary', () => {
    expect(classifyQuantization('베이스 얹어줘')).toBe('next_2bar')
    expect(classifyQuantization('패드 깔아줘')).toBe('next_2bar')
  })

  it('classifies style changes as next 4-bar boundary', () => {
    expect(classifyQuantization('UK garage 느낌으로 바꿔줘')).toBe('next_4bar')
  })

  it('schedules additions to the next 2-bar phrase', () => {
    const decision = computeScheduleDecision(base, '베이스 얹어줘')
    expect(decision.applyAtBar).toBe(3)
    expect(decision.applyInMs).toBe(4000)
  })

  it('schedules style changes to the next 4-bar phrase', () => {
    const decision = computeScheduleDecision(base, 'UK garage 느낌으로 바꿔줘')
    expect(decision.applyAtBar).toBe(5)
    expect(decision.applyInMs).toBe(8000)
  })

  it('pushes near-boundary commands to the following safe phrase', () => {
    const decision = computeScheduleDecision({ ...base, bar: 2, beat: 4, sixteenth: 4 }, '베이스 얹어줘', { safetyMs: 500 })
    expect(decision.applyAtBar).toBe(5)
    expect(decision.applyInMs).toBeGreaterThan(3000)
  })

  it('applies immediately when transport is stopped', () => {
    const decision = computeScheduleDecision({ ...base, isPlaying: false }, '킥 깔아줘')
    expect(decision.quantization).toBe('immediate')
    expect(decision.applyInMs).toBe(0)
  })
})
