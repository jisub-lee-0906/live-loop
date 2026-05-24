import type { FxRuntimeParams } from './audioRuntimeParams'
import type { AutomationCurve, NoteLength, PatternEvent } from './patternDsl'

export interface FxGesturePlayback {
  filterStart: number
  filterEnd: number
  rampSeconds: number
  length: NoteLength
  gainScale: number
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function shapeProgress(progress: number, shape: AutomationCurve['shape']): number {
  const t = clamp(progress, 0, 1)
  if (shape === 'rising') return t * t
  if (shape === 'falling') return 1 - (1 - t) * (1 - t)
  if (shape === 'pulse') return Math.sin(t * Math.PI)
  if (shape === 'exponential') return t * t * t
  return t
}

export function resolveAutomationValueAtStep(curves: AutomationCurve[] | undefined, parameter: AutomationCurve['parameter'], step: number, fallback: number): number {
  const curve = curves?.find((item) => item.parameter === parameter && step >= item.start_step && step <= item.end_step)
  if (!curve) return fallback
  const span = Math.max(1, curve.end_step - curve.start_step)
  const progress = shapeProgress((step - curve.start_step) / span, curve.shape)
  return curve.start_value + (curve.end_value - curve.start_value) * progress
}

export function resolveFxGesturePlayback(event: PatternEvent, params: FxRuntimeParams): FxGesturePlayback {
  const cutoff = clamp(params.filterCutoff, 300, 12000)
  const impactLike = params.release >= 1.6 && params.attack <= 0.02
  const tightGateLike = params.release <= 0.25
  const delayThrowLike = params.delayWet >= 0.45

  if (impactLike) {
    return {
      filterStart: Math.max(300, cutoff),
      filterEnd: clamp(cutoff * 0.16, 300, 900),
      rampSeconds: 0.5,
      length: event.length ?? '4n',
      gainScale: 1.08,
    }
  }

  if (tightGateLike) {
    return {
      filterStart: cutoff,
      filterEnd: cutoff,
      rampSeconds: 0,
      length: '16n',
      gainScale: 0.9,
    }
  }

  if (delayThrowLike) {
    return {
      filterStart: Math.max(1200, cutoff * 0.55),
      filterEnd: cutoff,
      rampSeconds: 0.12,
      length: event.length ?? '16n',
      gainScale: 0.88,
    }
  }

  return {
    filterStart: Math.max(300, cutoff * 0.16),
    filterEnd: cutoff,
    rampSeconds: 0.42,
    length: event.length ?? '16n',
    gainScale: 1,
  }
}
