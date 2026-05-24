import type { LayerId } from './loopState'
import type { MusicPatch, MusicPatchMacroValue, MusicPatchOperation } from './musicPatch'

export type InstrumentMacroName = 'preset' | 'filterCutoff' | 'resonance' | 'drive' | 'attack' | 'release' | 'reverbWet' | 'delayWet' | 'subOsc'
export type InstrumentPreset = 'default' | 'tight' | 'dark_sub' | 'rubbery_pluck' | 'wide_minor_pad' | 'airy_hats' | 'garage_shuffle' | 'acid' | 'reese' | 'sparkle_arp' | 'bell_pluck' | 'vinyl_air' | 'riser_sweep' | 'drop_impact' | 'delay_throw' | 'stutter_gate'

type MacroSchema =
  | { type: 'number'; min: number; max: number }
  | { type: 'boolean' }
  | { type: 'preset' }

export interface InstrumentCapability {
  id: LayerId
  label: string
  operations: MusicPatchOperation['type'][]
  macros: InstrumentMacroName[]
  macroSchemas: Partial<Record<InstrumentMacroName, MacroSchema>>
  presets: InstrumentPreset[]
  volumeRange: readonly [number, number]
  complexityRange: readonly [number, number]
}

const unitInterval = { type: 'number', min: 0, max: 1 } as const

export const instrumentCapabilities: Record<LayerId, InstrumentCapability> = {
  kick: {
    id: 'kick',
    label: 'Kick',
    operations: ['set_enabled', 'set_volume', 'set_complexity', 'set_macro'],
    macros: ['preset', 'drive'],
    macroSchemas: { preset: { type: 'preset' }, drive: unitInterval },
    presets: ['default', 'tight'],
    volumeRange: [0, 1],
    complexityRange: [0, 1],
  },
  snare: {
    id: 'snare',
    label: 'Snare',
    operations: ['set_enabled', 'set_volume', 'set_complexity', 'set_macro'],
    macros: ['preset', 'reverbWet'],
    macroSchemas: { preset: { type: 'preset' }, reverbWet: unitInterval },
    presets: ['default', 'tight'],
    volumeRange: [0, 1],
    complexityRange: [0, 1],
  },
  hats: {
    id: 'hats',
    label: 'Hats',
    operations: ['set_enabled', 'set_volume', 'set_complexity', 'set_subdivision', 'set_macro'],
    macros: ['preset', 'release'],
    macroSchemas: { preset: { type: 'preset' }, release: { type: 'number', min: 0.01, max: 0.5 } },
    presets: ['default', 'airy_hats', 'garage_shuffle'],
    volumeRange: [0, 1],
    complexityRange: [0, 1],
  },
  bass: {
    id: 'bass',
    label: 'Bass',
    operations: ['set_enabled', 'set_volume', 'set_complexity', 'set_macro'],
    macros: ['preset', 'filterCutoff', 'resonance', 'drive', 'subOsc'],
    macroSchemas: {
      preset: { type: 'preset' },
      filterCutoff: { type: 'number', min: 80, max: 5000 },
      resonance: { type: 'number', min: 0.1, max: 12 },
      drive: unitInterval,
      subOsc: { type: 'boolean' },
    },
    presets: ['default', 'dark_sub', 'rubbery_pluck', 'acid', 'reese'],
    volumeRange: [0, 1],
    complexityRange: [0, 1],
  },
  pad: {
    id: 'pad',
    label: 'Pad',
    operations: ['set_enabled', 'set_volume', 'set_complexity', 'set_macro'],
    macros: ['preset', 'filterCutoff', 'attack', 'release', 'reverbWet'],
    macroSchemas: {
      preset: { type: 'preset' },
      filterCutoff: { type: 'number', min: 120, max: 6000 },
      attack: { type: 'number', min: 0.001, max: 4 },
      release: { type: 'number', min: 0.05, max: 8 },
      reverbWet: unitInterval,
    },
    presets: ['default', 'wide_minor_pad'],
    volumeRange: [0, 1],
    complexityRange: [0, 1],
  },
  lead: {
    id: 'lead',
    label: 'Lead',
    operations: ['set_enabled', 'set_volume', 'set_complexity', 'set_macro'],
    macros: ['preset', 'filterCutoff', 'attack', 'release', 'reverbWet', 'delayWet'],
    macroSchemas: {
      preset: { type: 'preset' },
      filterCutoff: { type: 'number', min: 400, max: 9000 },
      attack: { type: 'number', min: 0.001, max: 2 },
      release: { type: 'number', min: 0.03, max: 4 },
      reverbWet: unitInterval,
      delayWet: unitInterval,
    },
    presets: ['default', 'sparkle_arp', 'bell_pluck'],
    volumeRange: [0, 1],
    complexityRange: [0, 1],
  },
  texture: {
    id: 'texture',
    label: 'Texture',
    operations: ['set_enabled', 'set_volume', 'set_complexity', 'set_macro'],
    macros: ['preset', 'filterCutoff', 'attack', 'release', 'reverbWet'],
    macroSchemas: {
      preset: { type: 'preset' },
      filterCutoff: { type: 'number', min: 200, max: 7000 },
      attack: { type: 'number', min: 0.001, max: 4 },
      release: { type: 'number', min: 0.05, max: 8 },
      reverbWet: unitInterval,
    },
    presets: ['default', 'vinyl_air'],
    volumeRange: [0, 1],
    complexityRange: [0, 1],
  },
  fx: {
    id: 'fx',
    label: 'FX',
    operations: ['set_enabled', 'set_volume', 'set_complexity', 'set_macro', 'set_pattern_events', 'set_automation'],
    macros: ['preset', 'filterCutoff', 'attack', 'release', 'reverbWet', 'delayWet'],
    macroSchemas: {
      preset: { type: 'preset' },
      filterCutoff: { type: 'number', min: 300, max: 12000 },
      attack: { type: 'number', min: 0.001, max: 4 },
      release: { type: 'number', min: 0.05, max: 8 },
      reverbWet: unitInterval,
      delayWet: unitInterval,
    },
    presets: ['default', 'riser_sweep', 'drop_impact', 'delay_throw', 'stutter_gate'],
    volumeRange: [0, 1],
    complexityRange: [0, 1],
  },
}

export function getInstrumentCapability(layerId: LayerId): InstrumentCapability {
  return instrumentCapabilities[layerId]
}

function inRange(value: number, range: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= range[0] && value <= range[1]
}

function isMacroValueSupported(capability: InstrumentCapability, name: InstrumentMacroName, value: MusicPatchMacroValue): boolean {
  if (!capability.macros.includes(name)) return false

  const schema = capability.macroSchemas[name]
  if (!schema) return false
  if (schema.type === 'preset') return typeof value === 'string' && capability.presets.includes(value as InstrumentPreset)
  if (schema.type === 'boolean') return typeof value === 'boolean'
  return typeof value === 'number' && inRange(value, [schema.min, schema.max])
}

export function isPatchSupported(patch: MusicPatch): boolean {
  const capability = getInstrumentCapability(patch.target)

  return patch.operations.every((operation) => {
    if (!capability.operations.includes(operation.type)) return false

    if (operation.type === 'set_volume') return inRange(operation.value, capability.volumeRange)
    if (operation.type === 'set_complexity') return inRange(operation.value, capability.complexityRange)
    if (operation.type === 'set_subdivision') return patch.target === 'hats'
    if (operation.type === 'set_macro') return isMacroValueSupported(capability, operation.name, operation.value)
    if (operation.type === 'set_pattern_events') {
      return (
        patch.target === 'fx' &&
        operation.value.length <= 16 &&
        operation.value.every((event) => event.voice === 'fx' && Number.isInteger(event.step) && event.step >= 0 && event.step <= 15 && Number.isFinite(event.velocity) && event.velocity >= 0 && event.velocity <= 1)
      )
    }
    if (operation.type === 'set_automation') {
      return (
        patch.target === 'fx' &&
        operation.value.length <= 8 &&
        operation.value.every(
          (curve) =>
            ['filterCutoff', 'reverbWet', 'delayWet', 'volume', 'gate'].includes(curve.parameter) &&
            Number.isInteger(curve.start_step) &&
            Number.isInteger(curve.end_step) &&
            curve.start_step >= 0 &&
            curve.start_step <= 15 &&
            curve.end_step > curve.start_step &&
            curve.end_step <= 16 &&
            Number.isFinite(curve.start_value) &&
            Number.isFinite(curve.end_value) &&
            ['linear', 'exponential', 'rising', 'falling', 'pulse'].includes(curve.shape),
        )
      )
    }

    return true
  })
}
