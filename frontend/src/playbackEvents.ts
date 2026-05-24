import type { LoopState } from './loopState'
import { resolveStepEvents, type PatternEvent } from './patternDsl'

function normalizeStep(step: number, steps: number): number {
  return ((Math.trunc(step) % steps) + steps) % steps
}

function supplementalHatEvent(state: LoopState, step: number, existingEvents: PatternEvent[]): PatternEvent | undefined {
  const hats = state.layers.hats
  const drums = state.pattern.layers.drums
  const normalized = normalizeStep(step, drums.steps)

  if (!hats.enabled) return undefined
  if (hats.subdivision !== '16n') return undefined
  if (existingEvents.some((event) => event.voice === 'hat' && event.step === normalized)) return undefined

  const velocity = normalized % 4 === 0 ? 0.42 : normalized % 2 === 0 ? 0.34 : 0.28
  return { step: normalized, voice: 'hat', velocity: velocity * (0.75 + hats.complexity * 0.35), length: '16n' }
}

export function resolvePlaybackStepEvents(state: LoopState, step: number): PatternEvent[] {
  const events = Object.values(state.pattern.layers).flatMap((layer) => resolveStepEvents(layer, step))
  const hat = supplementalHatEvent(state, step, events)
  return hat ? [...events, hat] : events
}
