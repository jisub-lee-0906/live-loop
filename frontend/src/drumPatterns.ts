export interface SnareTrigger {
  hit: boolean
  accent: number
}

function normalizeStep(step: number): number {
  return ((Math.trunc(step) % 16) + 16) % 16
}

export function shouldTriggerKick(step: number, complexity: number): boolean {
  const s = normalizeStep(step)
  if ([0, 4, 8, 12].includes(s)) return true
  if (complexity >= 0.55 && [7, 15].includes(s)) return true
  if (complexity >= 0.75 && [6, 14].includes(s)) return true
  return false
}

export function shouldTriggerSnare(step: number, complexity: number): SnareTrigger {
  const s = normalizeStep(step)
  if ([4, 12].includes(s)) return { hit: true, accent: 1 }
  if (complexity >= 0.5 && [3, 11].includes(s)) return { hit: true, accent: 0.35 }
  if (complexity >= 0.75 && [15].includes(s)) return { hit: true, accent: 0.28 }
  return { hit: false, accent: 0 }
}

export function shouldTriggerHat(step: number, complexity: number): boolean {
  const s = normalizeStep(step)
  if (complexity >= 0.5) return true
  return s % 2 === 0
}

export function hatAccent(step: number, complexity: number): number {
  const s = normalizeStep(step)
  if (s % 4 === 0) return 0.85
  if (complexity >= 0.65 && s % 2 === 1) return 0.46
  return 0.62
}
