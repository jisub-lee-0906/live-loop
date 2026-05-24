import type { LayerId } from './loopState'
import type { MusicPatch, MusicPatchMacroValue, MusicPatchOperation, MusicPatchTiming } from './musicPatch'
import type { AutomationCurve, PatternEvent } from './patternDsl'
import type { InstrumentMacroName } from './instrumentCapabilities'

export type ArrangementPlanTiming = 'now' | 'next_bar' | 'next_phrase'
export type ArrangementPlanTarget = LayerId | 'mix'

export interface ArrangementPlanOperation {
  type: 'set_enabled' | 'set_volume' | 'set_complexity' | 'set_macro' | 'set_pattern_events' | 'preserve_layer'
  name?: string | null
  value?: boolean | number | string | Array<Record<string, unknown>> | null
}

export interface ArrangementPlanPatch {
  target: ArrangementPlanTarget
  reason: string
  operations: ArrangementPlanOperation[]
  pattern_events?: PatternEvent[]
  automation?: Array<Record<string, unknown>>
  shape?: Record<string, unknown> | null
}

export interface ArrangementPlan {
  intent: 'arrange' | 'transition' | 'modify' | 'mute' | 'panic'
  timing: ArrangementPlanTiming
  summary: string
  preserve: ArrangementPlanTarget[]
  patches: ArrangementPlanPatch[]
  knowledge_entry_ids: string[]
  confidence: number
}

const layerIds: LayerId[] = ['kick', 'snare', 'hats', 'bass', 'pad', 'lead', 'texture', 'fx']
const macroNames: InstrumentMacroName[] = ['preset', 'filterCutoff', 'resonance', 'drive', 'attack', 'release', 'reverbWet', 'delayWet', 'subOsc']
const automationParameters: AutomationCurve['parameter'][] = ['filterCutoff', 'reverbWet', 'delayWet', 'volume', 'gate']
const automationShapes: AutomationCurve['shape'][] = ['linear', 'exponential', 'rising', 'falling', 'pulse']

function isLayerId(value: string): value is LayerId {
  return layerIds.includes(value as LayerId)
}

function isMacroName(value: string | null | undefined): value is InstrumentMacroName {
  return Boolean(value && macroNames.includes(value as InstrumentMacroName))
}

function timingFromPlan(timing: ArrangementPlanTiming): MusicPatchTiming {
  return timing === 'now' || timing === 'next_phrase' ? timing : 'next_bar'
}

function isPatchMacroValue(value: unknown): value is MusicPatchMacroValue {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function normalizePatternEvent(value: Record<string, unknown>): PatternEvent | undefined {
  const step = value.step
  const voice = value.voice
  const velocity = value.velocity
  if (typeof step !== 'number' || !Number.isInteger(step) || step < 0 || step > 15) return undefined
  if (typeof voice !== 'string' || !['kick', 'snare', 'hat', 'bass', 'pad', 'lead', 'texture', 'fx'].includes(voice)) return undefined
  if (typeof velocity !== 'number' || velocity < 0 || velocity > 1) return undefined
  const event: PatternEvent = { step, voice: voice as PatternEvent['voice'], velocity }
  if (typeof value.note === 'string') event.note = value.note
  if (typeof value.length === 'string' && ['16n', '8n', '4n', '2n', '1m'].includes(value.length)) event.length = value.length as PatternEvent['length']
  return event
}

function normalizeAutomationCurve(value: Record<string, unknown>): AutomationCurve | undefined {
  const parameter = value.parameter
  const startStep = value.start_step
  const endStep = value.end_step
  const startValue = value.start_value
  const endValue = value.end_value
  const shape = value.shape ?? 'linear'
  if (typeof parameter !== 'string' || !automationParameters.includes(parameter as AutomationCurve['parameter'])) return undefined
  if (typeof startStep !== 'number' || !Number.isInteger(startStep) || startStep < 0 || startStep > 15) return undefined
  if (typeof endStep !== 'number' || !Number.isInteger(endStep) || endStep <= startStep || endStep > 16) return undefined
  if (typeof startValue !== 'number' || !Number.isFinite(startValue)) return undefined
  if (typeof endValue !== 'number' || !Number.isFinite(endValue)) return undefined
  if (typeof shape !== 'string' || !automationShapes.includes(shape as AutomationCurve['shape'])) return undefined
  return { parameter: parameter as AutomationCurve['parameter'], start_step: startStep, end_step: endStep, start_value: startValue, end_value: endValue, shape: shape as AutomationCurve['shape'] }
}

function operationsFromPlanPatch(planPatch: ArrangementPlanPatch): MusicPatchOperation[] {
  const operations: MusicPatchOperation[] = []
  for (const operation of planPatch.operations) {
    if (operation.type === 'set_enabled' && typeof operation.value === 'boolean') operations.push({ type: 'set_enabled', value: operation.value })
    if (operation.type === 'set_volume' && typeof operation.value === 'number') operations.push({ type: 'set_volume', value: operation.value })
    if (operation.type === 'set_complexity' && typeof operation.value === 'number') operations.push({ type: 'set_complexity', value: operation.value })
    if (operation.type === 'set_macro' && isMacroName(operation.name) && isPatchMacroValue(operation.value)) {
      operations.push({ type: 'set_macro', name: operation.name, value: operation.value })
    }
    if (operation.type === 'set_pattern_events' && Array.isArray(operation.value)) {
      const events = operation.value.map((item) => (typeof item === 'object' && item !== null ? normalizePatternEvent(item) : undefined)).filter((item): item is PatternEvent => Boolean(item))
      if (events.length) operations.push({ type: 'set_pattern_events', value: events })
    }
  }
  if (!operations.some((operation) => operation.type === 'set_pattern_events') && planPatch.pattern_events?.length) {
    const events = planPatch.pattern_events.map((item) => normalizePatternEvent(item as unknown as Record<string, unknown>)).filter((item): item is PatternEvent => Boolean(item))
    if (events.length) operations.push({ type: 'set_pattern_events', value: events })
  }
  if (planPatch.automation?.length) {
    const curves = planPatch.automation.map((item) => normalizeAutomationCurve(item)).filter((item): item is AutomationCurve => Boolean(item))
    if (curves.length) operations.push({ type: 'set_automation', value: curves })
  }
  return operations
}

export function musicPatchesFromArrangementPlan(plan: ArrangementPlan): MusicPatch[] {
  const timing = timingFromPlan(plan.timing)
  return plan.patches
    .filter((patch) => isLayerId(patch.target))
    .map((patch, index) => ({
      id: `arrangement-${plan.intent}-${patch.target}-${index}`,
      label: `${plan.summary}: ${patch.reason}`,
      target: patch.target as LayerId,
      timing,
      operations: operationsFromPlanPatch(patch),
    }))
    .filter((patch) => patch.operations.length > 0)
}
