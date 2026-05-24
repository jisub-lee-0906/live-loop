import { describe, expect, it } from 'vitest'
import { barDurationMs, classifyQuantization, computeScheduleDecision, describeSchedule } from './quantizedScheduler'

const base = { bpm: 120, bar: 1, beat: 1, sixteenth: 1, seconds: 0, isPlaying: true }

describe('quantizedScheduler', () => {
  it('computes 4/4 bar duration from bpm', () => {
    expect(barDurationMs(120)).toBe(2000)
  })

  it('classifies layer additions as next-bar boundary for responsive loop stacking', () => {
    expect(classifyQuantization('베이스 얹어줘')).toBe('next_bar')
    expect(classifyQuantization('패드 깔아줘')).toBe('next_bar')
  })

  it('classifies style changes as next 4-bar boundary', () => {
    expect(classifyQuantization('UK garage 느낌으로 바꿔줘')).toBe('next_4bar')
  })

  it('classifies panic and normal stop commands as immediate', () => {
    expect(classifyQuantization('panic')).toBe('immediate')
    expect(classifyQuantization('패닉')).toBe('immediate')
    expect(classifyQuantization('비상정지')).toBe('immediate')
    expect(classifyQuantization('멈춰')).toBe('immediate')
    expect(classifyQuantization('정지')).toBe('immediate')
  })

  it('keeps normal layer mute/remove commands quantized to the next bar', () => {
    expect(classifyQuantization('베이스 빼')).toBe('next_bar')
    expect(classifyQuantization('하이햇 꺼')).toBe('next_bar')
  })

  it('schedules additions to the next bar for one-by-one loop stacking', () => {
    const decision = computeScheduleDecision(base, '베이스 얹어줘')
    expect(decision.applyAtBar).toBe(2)
    expect(decision.barsUntilApply).toBe(1)
    expect(decision.applyInMs).toBe(2000)
  })

  it('schedules style changes to the next 4-bar phrase', () => {
    const decision = computeScheduleDecision(base, 'UK garage 느낌으로 바꿔줘')
    expect(decision.applyAtBar).toBe(5)
    expect(decision.applyInMs).toBe(8000)
  })

  it('uses the next phrase boundary from each 1-indexed transport bar', () => {
    expect(computeScheduleDecision({ ...base, bar: 1 }, 'UK garage 느낌으로 바꿔줘').applyAtBar).toBe(5)
    expect(computeScheduleDecision({ ...base, bar: 2 }, 'UK garage 느낌으로 바꿔줘').applyAtBar).toBe(5)
    expect(computeScheduleDecision({ ...base, bar: 3 }, 'UK garage 느낌으로 바꿔줘').applyAtBar).toBe(5)
    expect(computeScheduleDecision({ ...base, bar: 4 }, 'UK garage 느낌으로 바꿔줘').applyAtBar).toBe(5)
    expect(computeScheduleDecision({ ...base, bar: 5 }, 'UK garage 느낌으로 바꿔줘').applyAtBar).toBe(9)
  })

  it('pushes near-boundary commands to the following safe phrase', () => {
    const decision = computeScheduleDecision({ ...base, bar: 2, beat: 4, sixteenth: 4 }, '베이스 얹어줘', { safetyMs: 500 })
    expect(decision.applyAtBar).toBe(4)
    expect(decision.applyInMs).toBeGreaterThan(1000)
  })

  it('describes long-running transport schedules as relative bars, not absolute bar numbers', () => {
    const decision = computeScheduleDecision({ ...base, bar: 1827 }, '베이스 얹어줘')
    expect(decision.applyAtBar).toBe(1828)
    expect(decision.barsUntilApply).toBe(1)
    expect(describeSchedule(decision)).toBe('다음 마디에 들어갑니다')
  })

  it('applies immediately when transport is stopped', () => {
    const decision = computeScheduleDecision({ ...base, isPlaying: false }, '킥 깔아줘')
    expect(decision.quantization).toBe('immediate')
    expect(decision.applyInMs).toBe(0)
  })

  it('can force scheduling from validated patch timing instead of raw text heuristics', () => {
    const volumeNow = computeScheduleDecision(base, '베이스 볼륨 크게', { forceQuantization: 'immediate' })
    const swingNextBar = computeScheduleDecision(base, '스윙 0.7', { forceQuantization: 'next_bar' })
    const bpmNextPhrase = computeScheduleDecision(base, 'bpm 150', { forceQuantization: 'next_phrase' })

    expect(volumeNow.quantization).toBe('immediate')
    expect(volumeNow.applyInMs).toBe(0)
    expect(swingNextBar.applyAtBar).toBe(2)
    expect(bpmNextPhrase.applyAtBar).toBe(5)
  })
})
