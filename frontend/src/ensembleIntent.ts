import type { MusicPatch } from './musicPatch'
import type { MusicalIntentDelta } from './musicalIntent'

function withholdFxPatch(): MusicPatch {
  return {
    id: 'intent-withhold-fx-v0',
    label: 'Withheld phrase-end tension FX',
    target: 'fx',
    timing: 'next_phrase',
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.36 },
      { type: 'set_complexity', value: 0.72 },
      { type: 'set_macro', name: 'filterCutoff', value: 7600 },
      { type: 'set_macro', name: 'reverbWet', value: 0.3 },
      { type: 'set_macro', name: 'delayWet', value: 0.24 },
      { type: 'set_macro', name: 'release', value: 0.18 },
      {
        type: 'set_pattern_events',
        value: [
          { step: 11, voice: 'fx', velocity: 0.18, length: '16n' },
          { step: 13, voice: 'fx', velocity: 0.26, length: '16n' },
          { step: 15, voice: 'fx', velocity: 0.34, length: '16n' },
        ],
      },
      {
        type: 'set_automation',
        value: [
          { parameter: 'gate', start_step: 10, end_step: 16, start_value: 0.25, end_value: 0.72, shape: 'rising' },
          { parameter: 'filterCutoff', start_step: 10, end_step: 16, start_value: 1800, end_value: 7600, shape: 'rising' },
        ],
      },
    ],
  }
}

function textureAirPatch(id = 'intent-texture-air-v0', timing: MusicPatch['timing'] = 'next_phrase'): MusicPatch {
  return {
    id,
    label: 'Air and distance texture response',
    target: 'texture',
    timing,
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.28 },
      { type: 'set_complexity', value: 0.24 },
      { type: 'set_macro', name: 'preset', value: 'vinyl_air' },
      { type: 'set_macro', name: 'filterCutoff', value: 2400 },
      { type: 'set_macro', name: 'reverbWet', value: 0.68 },
      { type: 'set_macro', name: 'attack', value: 0.9 },
      { type: 'set_macro', name: 'release', value: 4.2 },
    ],
  }
}

function releaseFxPatch(): MusicPatch {
  return {
    id: 'intent-release-fx-v0',
    label: 'Release promised drop punctuation',
    target: 'fx',
    timing: 'next_bar',
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.5 },
      { type: 'set_complexity', value: 0.66 },
      { type: 'set_macro', name: 'preset', value: 'drop_impact' },
      { type: 'set_macro', name: 'filterCutoff', value: 2400 },
      { type: 'set_macro', name: 'reverbWet', value: 0.58 },
      { type: 'set_macro', name: 'delayWet', value: 0.08 },
      { type: 'set_macro', name: 'attack', value: 0.004 },
      { type: 'set_macro', name: 'release', value: 2.2 },
      { type: 'set_pattern_events', value: [{ step: 0, voice: 'fx', velocity: 0.72, length: '4n' }] },
    ],
  }
}

function hatsCarvePatch(): MusicPatch {
  return {
    id: 'intent-carve-hats-v0',
    label: 'Carve space by lowering hats',
    target: 'hats',
    timing: 'next_bar',
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.28 },
      { type: 'set_complexity', value: 0.22 },
      { type: 'set_macro', name: 'release', value: 0.05 },
    ],
  }
}

function leadSilencePatch(): MusicPatch {
  return {
    id: 'intent-carve-lead-silence-v0',
    label: 'Silence lead so the loop can breathe',
    target: 'lead',
    timing: 'next_bar',
    operations: [{ type: 'set_enabled', value: false }],
  }
}

export function ensemblePatchesFromIntent(intent: MusicalIntentDelta): MusicPatch[] {
  if (intent.gesture === 'withhold_release' || intent.gesture === 'wait') {
    return [withholdFxPatch(), textureAirPatch()]
  }

  if (intent.gesture === 'release') {
    return [releaseFxPatch()]
  }

  if (intent.gesture === 'carve_space') {
    return [hatsCarvePatch(), leadSilencePatch(), textureAirPatch('intent-carve-texture-v0', 'next_bar')]
  }

  if (intent.gesture === 'space_shift') {
    return [textureAirPatch('intent-space-texture-v0', intent.time_horizon === 'one_phrase' ? 'next_phrase' : 'next_bar')]
  }

  return []
}
