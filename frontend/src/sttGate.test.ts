import { describe, expect, it } from 'vitest'
import { analyzePcmVoiceGate } from './sttGate'

function constantSignal(value: number, seconds = 0.5, sampleRate = 16000) {
  return new Float32Array(Math.floor(seconds * sampleRate)).fill(value)
}

describe('analyzePcmVoiceGate', () => {
  it('rejects very short recordings before STT', () => {
    const result = analyzePcmVoiceGate([constantSignal(0.5, 0.05)], 16000)
    expect(result.shouldTranscribe).toBe(false)
    expect(result.reason).toBe('too-short')
  })

  it('rejects quiet leakage below the voice threshold', () => {
    const result = analyzePcmVoiceGate([constantSignal(0.006)], 16000)
    expect(result.shouldTranscribe).toBe(false)
    expect(result.reason).toBe('too-quiet')
  })

  it('allows clear voice-level input through to STT', () => {
    const result = analyzePcmVoiceGate([constantSignal(0.08)], 16000)
    expect(result.shouldTranscribe).toBe(true)
    expect(result.reason).toBe('ok')
  })
})
