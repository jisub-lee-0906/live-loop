import type { CommandLogEntry, LoopState } from './loopState'
import type { AutomationCurve, PatternEvent, PatternLayer } from './patternDsl'

export interface DebugPlanSummary {
  command: string
  source: string
  knowledge: string
  preserve: string
  pending: string
  activeLayers: string
  pattern: string
  fxEvents: string
  fxAutomation: string
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function formatCommand(entry: CommandLogEntry | undefined): string {
  if (!entry) return 'no command yet'
  const target = entry.target ? ` → ${entry.target}` : ''
  return `${entry.action}${target}: ${entry.summary}`
}

function formatPending(state: LoopState): string {
  if (!state.pendingPatch) return 'none'
  const patch = state.pendingPatch
  return `${patch.label} → ${patch.target} @ ${patch.timing}`
}

function formatActiveLayers(state: LoopState): string {
  const active = Object.values(state.layers)
    .filter((layer) => layer.enabled && layer.volume > 0)
    .map((layer) => `${layer.id}:${formatNumber(layer.volume)}`)
  return active.length ? active.join(' · ') : 'silent'
}

function formatEvent(event: PatternEvent): string {
  const length = event.length ? `/${event.length}` : ''
  const note = event.note ? ` ${event.note}` : ''
  return `${event.step}:${event.voice}${note}@${formatNumber(event.velocity)}${length}`
}

function formatLayerEvents(layer: PatternLayer | undefined): string {
  if (!layer || layer.events.length === 0) return 'none'
  return layer.events
    .slice()
    .sort((a, b) => a.step - b.step || a.voice.localeCompare(b.voice))
    .map(formatEvent)
    .join(' · ')
}

function formatAutomationCurve(curve: AutomationCurve): string {
  return `${curve.parameter} ${curve.start_step}-${curve.end_step} ${formatNumber(curve.start_value)}→${formatNumber(curve.end_value)} ${curve.shape}`
}

function formatLayerAutomation(layer: PatternLayer | undefined): string {
  if (!layer?.automation?.length) return 'none'
  return layer.automation.map(formatAutomationCurve).join(' · ')
}

function formatPlanSource(entry: CommandLogEntry | undefined): string {
  if (!entry?.plan) return 'local/deterministic'
  const confidence = typeof entry.plan.confidence === 'number' ? ` · conf ${formatNumber(entry.plan.confidence)}` : ''
  const summary = entry.plan.planSummary ? ` · ${entry.plan.planSummary}` : ''
  return `${entry.plan.source ?? 'arrangement-plan'}${confidence}${summary}`
}

function formatKnowledge(entry: CommandLogEntry | undefined): string {
  const ids = entry?.plan?.knowledgeEntryIds ?? []
  return ids.length ? ids.join(' · ') : 'none'
}

function formatPreserve(entry: CommandLogEntry | undefined): string {
  const preserve = entry?.plan?.preserve ?? []
  return preserve.length ? preserve.join(' · ') : 'none'
}

export function createDebugPlanSummary(state: LoopState): DebugPlanSummary {
  const latestCommand = state.commandLog[0]
  const fxLayer = state.pattern.layers.fx
  return {
    command: formatCommand(latestCommand),
    source: formatPlanSource(latestCommand),
    knowledge: formatKnowledge(latestCommand),
    preserve: formatPreserve(latestCommand),
    pending: formatPending(state),
    activeLayers: formatActiveLayers(state),
    pattern: `${state.pattern.name} · ${state.bpm} BPM · ${state.pattern.key}`,
    fxEvents: formatLayerEvents(fxLayer),
    fxAutomation: formatLayerAutomation(fxLayer),
  }
}
