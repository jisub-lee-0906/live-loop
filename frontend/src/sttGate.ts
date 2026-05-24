export interface VoiceGateStats {
  durationMs: number
  rms: number
  peak: number
  activeRatio: number
}

export interface VoiceGateOptions {
  minDurationMs?: number
  minRms?: number
  minPeak?: number
  activeSampleThreshold?: number
  minActiveRatio?: number
}

export interface VoiceGateResult {
  shouldTranscribe: boolean
  stats: VoiceGateStats | null
  reason: 'ok' | 'too-short' | 'too-quiet' | 'decode-failed'
}

const DEFAULT_OPTIONS: Required<VoiceGateOptions> = {
  minDurationMs: 180,
  minRms: 0.012,
  minPeak: 0.045,
  activeSampleThreshold: 0.018,
  minActiveRatio: 0.015,
}

export function analyzePcmVoiceGate(
  channels: Float32Array[],
  sampleRate: number,
  options: VoiceGateOptions = {},
): VoiceGateResult {
  const config = { ...DEFAULT_OPTIONS, ...options }
  const sampleCount = Math.max(0, ...channels.map((channel) => channel.length))
  const durationMs = sampleRate > 0 ? (sampleCount / sampleRate) * 1000 : 0
  if (durationMs < config.minDurationMs || sampleCount === 0 || channels.length === 0) {
    return {
      shouldTranscribe: false,
      reason: 'too-short',
      stats: { durationMs, rms: 0, peak: 0, activeRatio: 0 },
    }
  }

  let sumSquares = 0
  let peak = 0
  let active = 0
  let total = 0

  for (const channel of channels) {
    for (const sample of channel) {
      const value = Math.abs(sample)
      sumSquares += value * value
      if (value > peak) peak = value
      if (value >= config.activeSampleThreshold) active += 1
      total += 1
    }
  }

  const rms = total > 0 ? Math.sqrt(sumSquares / total) : 0
  const activeRatio = total > 0 ? active / total : 0
  const stats = { durationMs, rms, peak, activeRatio }

  if (rms < config.minRms || peak < config.minPeak || activeRatio < config.minActiveRatio) {
    return { shouldTranscribe: false, reason: 'too-quiet', stats }
  }

  return { shouldTranscribe: true, reason: 'ok', stats }
}

export async function shouldTranscribeRecordedAudio(blob: Blob, options: VoiceGateOptions = {}): Promise<VoiceGateResult> {
  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext
  if (!AudioContextConstructor) return { shouldTranscribe: true, reason: 'decode-failed', stats: null }

  const audioContext = new AudioContextConstructor()
  try {
    const buffer = await audioContext.decodeAudioData(await blob.arrayBuffer())
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index))
    return analyzePcmVoiceGate(channels, buffer.sampleRate, options)
  } catch {
    // If the browser cannot decode the MediaRecorder container, do not block the
    // command path. Server-side ffmpeg/faster-whisper may still decode it.
    return { shouldTranscribe: true, reason: 'decode-failed', stats: null }
  } finally {
    await audioContext.close().catch(() => undefined)
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
