export type Quantization = 'immediate' | 'next_bar' | 'next_2bar' | 'next_4bar' | 'next_phrase'

export interface TransportPosition {
  bpm: number
  bar: number
  beat: number
  sixteenth: number
  seconds: number
  isPlaying: boolean
}

export interface ScheduleDecision {
  quantization: Quantization
  applyAtBar: number
  applyInMs: number
  phraseBars: number
  barsUntilApply: number
  reason: string
}

const DEFAULT_BEATS_PER_BAR = 4

export function barDurationMs(bpm: number, beatsPerBar = DEFAULT_BEATS_PER_BAR): number {
  return (60_000 / Math.max(1, bpm)) * beatsPerBar
}

export function classifyQuantization(text: string): Quantization {
  const normalized = text.toLowerCase()
  if (
    normalized.includes('panic') ||
    normalized.includes('패닉') ||
    normalized.includes('비상') ||
    normalized.includes('kill') ||
    normalized.includes('킬') ||
    normalized.includes('멈춰') ||
    normalized.includes('정지') ||
    normalized.includes('stop') ||
    normalized.includes('스탑')
  ) {
    return 'immediate'
  }
  if (normalized.includes('꺼') || normalized.includes('빼') || normalized.includes('mute')) {
    return 'next_bar'
  }
  if (
    normalized.includes('바꿔') ||
    normalized.includes('전환') ||
    normalized.includes('드랍') ||
    normalized.includes('garage') ||
    normalized.includes('개러지') ||
    normalized.includes('ambient') ||
    normalized.includes('앰비언트') ||
    normalized.includes('techno') ||
    normalized.includes('테크노') ||
    normalized.includes('하우스') ||
    normalized.includes('house')
  ) {
    return 'next_4bar'
  }
  if (normalized.includes('얹') || normalized.includes('추가') || normalized.includes('깔') || normalized.includes('넣')) {
    return 'next_bar'
  }
  return 'next_4bar'
}

function phraseBarsFor(quantization: Quantization): number {
  if (quantization === 'immediate') return 0
  if (quantization === 'next_bar') return 1
  if (quantization === 'next_2bar') return 2
  return 4
}

function nextPhraseStartBar(currentBar: number, phraseBars: number): number {
  if (phraseBars <= 1) return currentBar + 1
  return Math.floor((currentBar - 1) / phraseBars) * phraseBars + phraseBars + 1
}

export function computeScheduleDecision(
  position: TransportPosition,
  text: string,
  options: { safetyMs?: number; nowMs?: number; forceQuantization?: Quantization } = {},
): ScheduleDecision {
  const quantization = !position.isPlaying ? 'immediate' : options.forceQuantization ?? classifyQuantization(text)
  if (quantization === 'immediate') {
    return { quantization, applyAtBar: position.bar, applyInMs: 0, phraseBars: 0, barsUntilApply: 0, reason: 'transport_stopped' }
  }

  const phraseBars = phraseBarsFor(quantization)
  const safetyMs = options.safetyMs ?? 320
  const oneBarMs = barDurationMs(position.bpm)
  const currentBarElapsedMs = ((position.beat - 1) / DEFAULT_BEATS_PER_BAR) * oneBarMs + ((position.sixteenth - 1) / 16) * oneBarMs
  const currentBarRemainingMs = Math.max(0, oneBarMs - currentBarElapsedMs)
  const candidateBar = nextPhraseStartBar(position.bar, phraseBars)
  const barsUntilCandidate = Math.max(0, candidateBar - position.bar - 1)
  let applyInMs = currentBarRemainingMs + barsUntilCandidate * oneBarMs
  let applyAtBar = candidateBar

  if (applyInMs < safetyMs) {
    applyAtBar += phraseBars
    applyInMs += phraseBars * oneBarMs
  }

  return {
    quantization,
    applyAtBar,
    applyInMs: Math.round(applyInMs),
    phraseBars,
    barsUntilApply: Math.max(0, applyAtBar - position.bar),
    reason: `${quantization}_boundary`,
  }
}

export function describeSchedule(decision: ScheduleDecision): string {
  if (decision.quantization === 'immediate') return '바로 들어갑니다'
  const bars = Math.max(1, decision.barsUntilApply)
  return bars === 1 ? '다음 마디에 들어갑니다' : `${bars}마디 뒤에 들어갑니다`
}
