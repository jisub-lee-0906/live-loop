import type { LayerId, LoopLayer, LoopState, Subdivision } from './loopState'

export interface KickRuntimeParams {
  kind: 'kick'
  drive: number
  volumeScale: number
}

export interface SnareRuntimeParams {
  kind: 'snare'
  reverbWet: number
  volumeScale: number
}

export interface HatsRuntimeParams {
  kind: 'hats'
  release: number
  brightness: number
  subdivision: Subdivision
  volumeScale: number
}

export interface BassRuntimeParams {
  kind: 'bass'
  filterCutoff: number
  resonance: number
  drive: number
  subOsc: boolean
  volumeScale: number
}

export interface PadRuntimeParams {
  kind: 'pad'
  filterCutoff: number
  attack: number
  release: number
  reverbWet: number
  volumeScale: number
}

export interface LeadRuntimeParams {
  kind: 'lead'
  filterCutoff: number
  attack: number
  release: number
  reverbWet: number
  delayWet: number
  volumeScale: number
}

export interface TextureRuntimeParams {
  kind: 'texture'
  filterCutoff: number
  attack: number
  release: number
  reverbWet: number
  volumeScale: number
}

export interface FxRuntimeParams {
  kind: 'fx'
  preset: string
  filterCutoff: number
  attack: number
  release: number
  reverbWet: number
  delayWet: number
  volumeScale: number
}

export type LayerRuntimeParams = KickRuntimeParams | SnareRuntimeParams | HatsRuntimeParams | BassRuntimeParams | PadRuntimeParams | LeadRuntimeParams | TextureRuntimeParams | FxRuntimeParams

export interface LoopRuntimeParams {
  kick: KickRuntimeParams
  snare: SnareRuntimeParams
  hats: HatsRuntimeParams
  bass: BassRuntimeParams
  pad: PadRuntimeParams
  lead: LeadRuntimeParams
  texture: TextureRuntimeParams
  fx: FxRuntimeParams
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function macroNumber(layer: LoopLayer, name: string, fallback: number, min: number, max: number): number {
  const value = layer.macros?.[name]
  return clamp(typeof value === 'number' ? value : fallback, min, max)
}

function macroBoolean(layer: LoopLayer, name: string, fallback: boolean): boolean {
  const value = layer.macros?.[name]
  return typeof value === 'boolean' ? value : fallback
}

function macroString(layer: LoopLayer, name: string, fallback: string): string {
  const value = layer.macros?.[name]
  return typeof value === 'string' ? value : fallback
}

function resolveKick(layer: LoopLayer): KickRuntimeParams {
  const preset = macroString(layer, 'preset', 'default')
  return {
    kind: 'kick',
    drive: macroNumber(layer, 'drive', preset === 'tight' ? 0.22 : 0.1, 0, 1),
    volumeScale: preset === 'tight' ? 1.08 : 1,
  }
}

function resolveSnare(layer: LoopLayer): SnareRuntimeParams {
  return {
    kind: 'snare',
    reverbWet: macroNumber(layer, 'reverbWet', 0.08, 0, 1),
    volumeScale: macroString(layer, 'preset', 'default') === 'tight' ? 1.03 : 1,
  }
}

function resolveHats(layer: LoopLayer): HatsRuntimeParams {
  const preset = macroString(layer, 'preset', 'default')
  return {
    kind: 'hats',
    release: macroNumber(layer, 'release', preset === 'airy_hats' ? 0.08 : 0.03, 0.01, 0.5),
    brightness: preset === 'airy_hats' ? 0.72 : 0.5,
    subdivision: layer.subdivision ?? '8n',
    volumeScale: preset === 'airy_hats' ? 1.08 : 1,
  }
}

function resolveBass(layer: LoopLayer): BassRuntimeParams {
  const preset = macroString(layer, 'preset', 'default')
  return {
    kind: 'bass',
    filterCutoff: macroNumber(layer, 'filterCutoff', preset === 'dark_sub' ? 420 : 760, 80, 5000),
    resonance: macroNumber(layer, 'resonance', preset === 'rubbery_pluck' ? 3.4 : 2.2, 0.1, 12),
    drive: macroNumber(layer, 'drive', preset === 'dark_sub' ? 0.18 : 0.1, 0, 1),
    subOsc: macroBoolean(layer, 'subOsc', preset === 'dark_sub'),
    volumeScale: preset === 'dark_sub' ? 0.82 : 1,
  }
}

function resolvePad(layer: LoopLayer): PadRuntimeParams {
  const preset = macroString(layer, 'preset', 'default')
  return {
    kind: 'pad',
    filterCutoff: macroNumber(layer, 'filterCutoff', preset === 'wide_minor_pad' ? 1100 : 1800, 120, 6000),
    attack: macroNumber(layer, 'attack', preset === 'wide_minor_pad' ? 0.35 : 0.7, 0.001, 4),
    release: macroNumber(layer, 'release', 2.2, 0.05, 8),
    reverbWet: macroNumber(layer, 'reverbWet', preset === 'wide_minor_pad' ? 0.42 : 0.28, 0, 1),
    volumeScale: preset === 'wide_minor_pad' ? 0.92 : 1,
  }
}

function resolveLead(layer: LoopLayer): LeadRuntimeParams {
  const preset = macroString(layer, 'preset', 'default')
  return {
    kind: 'lead',
    filterCutoff: macroNumber(layer, 'filterCutoff', preset === 'sparkle_arp' ? 5200 : 3200, 400, 9000),
    attack: macroNumber(layer, 'attack', preset === 'sparkle_arp' ? 0.006 : 0.02, 0.001, 2),
    release: macroNumber(layer, 'release', preset === 'sparkle_arp' ? 0.18 : 0.35, 0.03, 4),
    reverbWet: macroNumber(layer, 'reverbWet', preset === 'sparkle_arp' ? 0.34 : 0.22, 0, 1),
    delayWet: macroNumber(layer, 'delayWet', preset === 'sparkle_arp' ? 0.28 : 0.16, 0, 1),
    volumeScale: preset === 'sparkle_arp' ? 0.86 : 1,
  }
}

function resolveTexture(layer: LoopLayer): TextureRuntimeParams {
  const preset = macroString(layer, 'preset', 'default')
  return {
    kind: 'texture',
    filterCutoff: macroNumber(layer, 'filterCutoff', preset === 'vinyl_air' ? 2600 : 1800, 200, 7000),
    attack: macroNumber(layer, 'attack', preset === 'vinyl_air' ? 0.9 : 0.35, 0.001, 4),
    release: macroNumber(layer, 'release', preset === 'vinyl_air' ? 3.8 : 1.6, 0.05, 8),
    reverbWet: macroNumber(layer, 'reverbWet', preset === 'vinyl_air' ? 0.64 : 0.36, 0, 1),
    volumeScale: preset === 'vinyl_air' ? 0.72 : 1,
  }
}

function resolveFx(layer: LoopLayer): FxRuntimeParams {
  const preset = macroString(layer, 'preset', 'default')
  const defaults: Record<string, { filterCutoff: number; attack: number; release: number; reverbWet: number; delayWet: number; volumeScale: number }> = {
    riser_sweep: { filterCutoff: 9200, attack: 0.05, release: 1.2, reverbWet: 0.5, delayWet: 0.22, volumeScale: 0.78 },
    drop_impact: { filterCutoff: 2400, attack: 0.004, release: 2.2, reverbWet: 0.58, delayWet: 0.08, volumeScale: 0.92 },
    delay_throw: { filterCutoff: 6800, attack: 0.01, release: 0.72, reverbWet: 0.36, delayWet: 0.52, volumeScale: 0.74 },
    stutter_gate: { filterCutoff: 7600, attack: 0.002, release: 0.16, reverbWet: 0.28, delayWet: 0.26, volumeScale: 0.68 },
    default: { filterCutoff: 4200, attack: 0.02, release: 0.45, reverbWet: 0.24, delayWet: 0.08, volumeScale: 1 },
  }
  const fallback = defaults[preset] ?? defaults.default
  return {
    kind: 'fx',
    preset,
    filterCutoff: macroNumber(layer, 'filterCutoff', fallback.filterCutoff, 300, 12000),
    attack: macroNumber(layer, 'attack', fallback.attack, 0.001, 4),
    release: macroNumber(layer, 'release', fallback.release, 0.05, 8),
    reverbWet: macroNumber(layer, 'reverbWet', fallback.reverbWet, 0, 1),
    delayWet: macroNumber(layer, 'delayWet', fallback.delayWet, 0, 1),
    volumeScale: fallback.volumeScale,
  }
}

export function resolveLayerRuntimeParams(layer: LoopLayer): LayerRuntimeParams {
  const resolvers: Record<LayerId, (layer: LoopLayer) => LayerRuntimeParams> = {
    kick: resolveKick,
    snare: resolveSnare,
    hats: resolveHats,
    bass: resolveBass,
    pad: resolvePad,
    lead: resolveLead,
    texture: resolveTexture,
    fx: resolveFx,
  }
  return resolvers[layer.id](layer)
}

export function resolveRuntimeParams(state: LoopState): LoopRuntimeParams {
  return {
    kick: resolveKick(state.layers.kick),
    snare: resolveSnare(state.layers.snare),
    hats: resolveHats(state.layers.hats),
    bass: resolveBass(state.layers.bass),
    pad: resolvePad(state.layers.pad),
    lead: resolveLead(state.layers.lead),
    texture: resolveTexture(state.layers.texture),
    fx: resolveFx(state.layers.fx),
  }
}
