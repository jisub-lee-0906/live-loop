import type { MusicPatch } from './musicPatch'

export const patchCatalog: MusicPatch[] = [
  {
    id: 'kick-tight-four-v0',
    label: 'Tight four-on-the-floor kick',
    target: 'kick',
    timing: 'next_bar',
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.85 },
      { type: 'set_complexity', value: 0.25 },
      { type: 'set_macro', name: 'preset', value: 'tight' },
    ],
  },
  {
    id: 'snare-tight-backbeat-v0',
    label: 'Tight snare backbeat',
    target: 'snare',
    timing: 'next_bar',
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.68 },
      { type: 'set_macro', name: 'preset', value: 'tight' },
      { type: 'set_macro', name: 'reverbWet', value: 0.08 },
    ],
  },
  {
    id: 'hats-airy-16th-v0',
    label: 'Airy sixteenth hats',
    target: 'hats',
    timing: 'next_bar',
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.5 },
      { type: 'set_complexity', value: 0.7 },
      { type: 'set_subdivision', value: '16n' },
      { type: 'set_macro', name: 'preset', value: 'airy_hats' },
      { type: 'set_macro', name: 'release', value: 0.08 },
    ],
  },
  {
    id: 'kick-safe-mute-v0',
    label: 'Safe kick mute',
    target: 'kick',
    timing: 'next_bar',
    operations: [{ type: 'set_enabled', value: false }],
  },
  {
    id: 'snare-safe-mute-v0',
    label: 'Safe snare mute',
    target: 'snare',
    timing: 'next_bar',
    operations: [{ type: 'set_enabled', value: false }],
  },
  {
    id: 'hats-safe-mute-v0',
    label: 'Safe hats mute',
    target: 'hats',
    timing: 'next_bar',
    operations: [{ type: 'set_enabled', value: false }],
  },
  {
    id: 'bass-dark-sub-v0',
    label: 'Dark sub bass',
    target: 'bass',
    timing: 'next_bar',
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.78 },
      { type: 'set_complexity', value: 0.35 },
      { type: 'set_macro', name: 'preset', value: 'dark_sub' },
      { type: 'set_macro', name: 'filterCutoff', value: 420 },
      { type: 'set_macro', name: 'subOsc', value: true },
    ],
  },
  {
    id: 'bass-warm-round-v0',
    label: 'Warm round bass',
    target: 'bass',
    timing: 'next_bar',
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.74 },
      { type: 'set_complexity', value: 0.42 },
      { type: 'set_macro', name: 'preset', value: 'dark_sub' },
      { type: 'set_macro', name: 'filterCutoff', value: 560 },
      { type: 'set_macro', name: 'resonance', value: 1.4 },
      { type: 'set_macro', name: 'drive', value: 0.12 },
      { type: 'set_macro', name: 'subOsc', value: true },
    ],
  },
  {
    id: 'bass-rubbery-pluck-v0',
    label: 'Rubbery pluck bass',
    target: 'bass',
    timing: 'next_bar',
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.72 },
      { type: 'set_complexity', value: 0.55 },
      { type: 'set_macro', name: 'preset', value: 'rubbery_pluck' },
      { type: 'set_macro', name: 'filterCutoff', value: 760 },
      { type: 'set_macro', name: 'resonance', value: 3.4 },
    ],
  },
  {
    id: 'bass-safe-mute-v0',
    label: 'Safe bass mute',
    target: 'bass',
    timing: 'next_bar',
    operations: [{ type: 'set_enabled', value: false }],
  },
  {
    id: 'bass-safe-unmute-v0',
    label: 'Safe bass unmute',
    target: 'bass',
    timing: 'next_bar',
    operations: [{ type: 'set_enabled', value: true }],
  },
  {
    id: 'bass-drop-return-v0',
    label: 'Bass drop return',
    target: 'bass',
    timing: 'next_bar',
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.82 },
      { type: 'set_complexity', value: 0.52 },
      { type: 'set_macro', name: 'subOsc', value: true },
    ],
  },
  {
    id: 'pad-wide-minor-v0',
    label: 'Wide minor pad',
    target: 'pad',
    timing: 'next_bar',
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.42 },
      { type: 'set_macro', name: 'preset', value: 'wide_minor_pad' },
      { type: 'set_macro', name: 'filterCutoff', value: 1100 },
      { type: 'set_macro', name: 'reverbWet', value: 0.42 },
      { type: 'set_macro', name: 'attack', value: 0.35 },
    ],
  },
  {
    id: 'pad-wider-v0',
    label: 'Wider pad wash',
    target: 'pad',
    timing: 'next_bar',
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.46 },
      { type: 'set_macro', name: 'preset', value: 'wide_minor_pad' },
      { type: 'set_macro', name: 'filterCutoff', value: 1300 },
      { type: 'set_macro', name: 'reverbWet', value: 0.58 },
      { type: 'set_macro', name: 'attack', value: 0.55 },
      { type: 'set_macro', name: 'release', value: 3.8 },
    ],
  },
  {
    id: 'lead-sparkle-arp-v0',
    label: 'Sparkle arpeggio lead',
    target: 'lead',
    timing: 'next_bar',
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.36 },
      { type: 'set_complexity', value: 0.46 },
      { type: 'set_macro', name: 'preset', value: 'sparkle_arp' },
      { type: 'set_macro', name: 'filterCutoff', value: 5600 },
      { type: 'set_macro', name: 'reverbWet', value: 0.34 },
      { type: 'set_macro', name: 'delayWet', value: 0.28 },
      { type: 'set_macro', name: 'release', value: 0.18 },
    ],
  },
  {
    id: 'lead-safe-mute-v0',
    label: 'Safe lead mute',
    target: 'lead',
    timing: 'next_bar',
    operations: [{ type: 'set_enabled', value: false }],
  },
  {
    id: 'texture-vinyl-air-v0',
    label: 'Vinyl air texture bed',
    target: 'texture',
    timing: 'next_bar',
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.3 },
      { type: 'set_complexity', value: 0.28 },
      { type: 'set_macro', name: 'preset', value: 'vinyl_air' },
      { type: 'set_macro', name: 'filterCutoff', value: 2600 },
      { type: 'set_macro', name: 'reverbWet', value: 0.64 },
      { type: 'set_macro', name: 'attack', value: 0.9 },
      { type: 'set_macro', name: 'release', value: 3.8 },
    ],
  },
  {
    id: 'texture-safe-mute-v0',
    label: 'Safe texture mute',
    target: 'texture',
    timing: 'next_bar',
    operations: [{ type: 'set_enabled', value: false }],
  },
  {
    id: 'fx-riser-sweep-v0',
    label: 'Riser sweep transition FX',
    target: 'fx',
    timing: 'next_bar',
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.44 },
      { type: 'set_complexity', value: 0.55 },
      { type: 'set_macro', name: 'preset', value: 'riser_sweep' },
      { type: 'set_macro', name: 'filterCutoff', value: 9200 },
      { type: 'set_macro', name: 'reverbWet', value: 0.5 },
      { type: 'set_macro', name: 'delayWet', value: 0.22 },
      { type: 'set_macro', name: 'attack', value: 0.05 },
      { type: 'set_macro', name: 'release', value: 1.2 },
      { type: 'set_pattern_events', value: [{ step: 15, voice: 'fx', velocity: 0.42, length: '16n' }] },
    ],
  },
  {
    id: 'fx-drop-impact-v0',
    label: 'Drop impact transition FX',
    target: 'fx',
    timing: 'next_bar',
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.5 },
      { type: 'set_complexity', value: 0.7 },
      { type: 'set_macro', name: 'preset', value: 'drop_impact' },
      { type: 'set_macro', name: 'filterCutoff', value: 2400 },
      { type: 'set_macro', name: 'reverbWet', value: 0.58 },
      { type: 'set_macro', name: 'delayWet', value: 0.08 },
      { type: 'set_macro', name: 'attack', value: 0.004 },
      { type: 'set_macro', name: 'release', value: 2.2 },
      { type: 'set_pattern_events', value: [{ step: 0, voice: 'fx', velocity: 0.54, length: '4n' }] },
    ],
  },
  {
    id: 'fx-delay-throw-v0',
    label: 'Delay throw transition FX',
    target: 'fx',
    timing: 'next_bar',
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.38 },
      { type: 'set_complexity', value: 0.62 },
      { type: 'set_macro', name: 'preset', value: 'delay_throw' },
      { type: 'set_macro', name: 'filterCutoff', value: 6800 },
      { type: 'set_macro', name: 'reverbWet', value: 0.36 },
      { type: 'set_macro', name: 'delayWet', value: 0.52 },
      { type: 'set_macro', name: 'attack', value: 0.01 },
      { type: 'set_macro', name: 'release', value: 0.72 },
      { type: 'set_pattern_events', value: [{ step: 14, voice: 'fx', velocity: 0.3, length: '16n' }, { step: 15, voice: 'fx', velocity: 0.42, length: '16n' }] },
    ],
  },
  {
    id: 'fx-stutter-gate-v0',
    label: 'Stutter gate transition FX',
    target: 'fx',
    timing: 'next_bar',
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.34 },
      { type: 'set_complexity', value: 0.86 },
      { type: 'set_macro', name: 'preset', value: 'stutter_gate' },
      { type: 'set_macro', name: 'filterCutoff', value: 7600 },
      { type: 'set_macro', name: 'reverbWet', value: 0.28 },
      { type: 'set_macro', name: 'delayWet', value: 0.26 },
      { type: 'set_macro', name: 'attack', value: 0.002 },
      { type: 'set_macro', name: 'release', value: 0.16 },
      { type: 'set_pattern_events', value: [{ step: 12, voice: 'fx', velocity: 0.22, length: '16n' }, { step: 13, voice: 'fx', velocity: 0.28, length: '16n' }, { step: 14, voice: 'fx', velocity: 0.34, length: '16n' }, { step: 15, voice: 'fx', velocity: 0.42, length: '16n' }] },
    ],
  },
  {
    id: 'fx-safe-mute-v0',
    label: 'Safe FX mute',
    target: 'fx',
    timing: 'next_bar',
    operations: [{ type: 'set_enabled', value: false }],
  },
  {
    id: 'drums-busier-ukg-v0',
    label: 'Busier UKG-style drum lift',
    target: 'hats',
    timing: 'next_bar',
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.54 },
      { type: 'set_complexity', value: 0.78 },
      { type: 'set_subdivision', value: '16n' },
      { type: 'set_macro', name: 'preset', value: 'airy_hats' },
    ],
  },
  {
    id: 'drums-busier-preserve-kick-v0',
    label: 'Busier drums preserving kick',
    target: 'hats',
    timing: 'next_bar',
    operations: [
      { type: 'set_enabled', value: true },
      { type: 'set_volume', value: 0.56 },
      { type: 'set_complexity', value: 0.82 },
      { type: 'set_subdivision', value: '16n' },
      { type: 'set_macro', name: 'preset', value: 'airy_hats' },
      { type: 'set_macro', name: 'release', value: 0.09 },
    ],
  },
  {
    id: 'mix-darker-bass-v0',
    label: 'Darker bass mix',
    target: 'bass',
    timing: 'next_bar',
    operations: [
      { type: 'set_macro', name: 'filterCutoff', value: 360 },
      { type: 'set_macro', name: 'drive', value: 0.18 },
      { type: 'set_macro', name: 'subOsc', value: true },
    ],
  },
  {
    id: 'mix-darker-pad-v0',
    label: 'Darker pad wash',
    target: 'pad',
    timing: 'next_bar',
    operations: [
      { type: 'set_macro', name: 'filterCutoff', value: 760 },
      { type: 'set_macro', name: 'reverbWet', value: 0.5 },
    ],
  },
]

function clonePatch(patch: MusicPatch): MusicPatch {
  return {
    ...patch,
    operations: patch.operations.map((operation) => ({ ...operation })),
  }
}

function patchesById(ids: string[]): MusicPatch[] {
  return ids.map((id) => getPatchById(id)).filter((patch): patch is MusicPatch => Boolean(patch))
}

export function getPatchById(id: string): MusicPatch | undefined {
  const patch = patchCatalog.find((patch) => patch.id === id)
  return patch ? clonePatch(patch) : undefined
}

export function selectDeterministicPatches(rawText: string): MusicPatch[] {
  const text = rawText.trim().toLowerCase()
  if (!text) return []

  if (text.includes('다시') && (text.includes('드랍') || text.includes('drop'))) return patchesById(['bass-drop-return-v0', 'drums-busier-preserve-kick-v0'])
  if ((text.includes('전체') || text.includes('믹스') || text.includes('all') || text.includes('mix')) && (text.includes('어둡') || text.includes('dark'))) return patchesById(['mix-darker-bass-v0', 'mix-darker-pad-v0'])

  const mentionsDrums = text.includes('드럼') || text.includes('비트') || text.includes('리듬') || text.includes('beat') || text.includes('drum') || text.includes('groove')
  const asksToMute = text.includes('꺼') || text.includes('빼') || text.includes('뮤트') || text.includes('mute') || text.includes('off')
  if (mentionsDrums && asksToMute) return patchesById(['kick-safe-mute-v0', 'snare-safe-mute-v0', 'hats-safe-mute-v0'])

  if (text.includes('베이스') || text.includes('bass')) {
    if (text.includes('빼') || text.includes('꺼') || text.includes('mute')) return patchesById(['bass-safe-mute-v0'])
    if (text.includes('다시') && (text.includes('켜') || text.includes('unmute'))) return patchesById(['bass-safe-unmute-v0'])
    if (text.includes('다시') || text.includes('드랍') || text.includes('drop')) return patchesById(['bass-drop-return-v0'])
    if (text.includes('둥글') || text.includes('따뜻') || text.includes('warm') || text.includes('round')) return patchesById(['bass-warm-round-v0'])
    if (text.includes('고무') || text.includes('rubbery') || text.includes('pluck')) return patchesById(['bass-rubbery-pluck-v0'])
    return patchesById(['bass-dark-sub-v0'])
  }

  const asksForDrumGroove =
    (text.includes('드럼') || text.includes('비트') || text.includes('beat') || text.includes('drum')) &&
    (text.includes('추가') || text.includes('깔') || text.includes('넣') || text.includes('얹') || text.includes('add') || text.includes('make'))
  if (asksForDrumGroove) return patchesById(['kick-tight-four-v0', 'snare-tight-backbeat-v0', 'hats-airy-16th-v0'])

  if (
    text.includes('쪼개') ||
    text.includes('잘게') ||
    text.includes('복잡') ||
    text.includes('몰아') ||
    text.includes('complex') ||
    text.includes('busy') ||
    (text.includes('드럼') && (text.includes('uk') || text.includes('garage') || text.includes('개러지')))
  ) {
    if (text.includes('유지') || text.includes('preserve')) return patchesById(['drums-busier-preserve-kick-v0'])
    return patchesById(['drums-busier-ukg-v0'])
  }

  if (text.includes('하이햇') || text.includes('햇') || text.includes('hat')) return patchesById(['hats-airy-16th-v0'])
  if (text.includes('스네어') || text.includes('클랩') || text.includes('snare')) return patchesById(['snare-tight-backbeat-v0'])
  if (text.includes('킥') || text.includes('kick')) return patchesById(['kick-tight-four-v0'])
  if (text.includes('리드') || text.includes('멜로디') || text.includes('아르페지오') || text.includes('반짝') || text.includes('lead') || text.includes('arp') || text.includes('sparkle')) {
    if (asksToMute) return patchesById(['lead-safe-mute-v0'])
    return patchesById(['lead-sparkle-arp-v0'])
  }
  if (text.includes('fx') || text.includes('효과') || text.includes('전환') || text.includes('빌드업') || text.includes('라이저') || text.includes('riser') || text.includes('스윕') || text.includes('sweep') || text.includes('임팩트') || text.includes('impact') || text.includes('딜레이') || text.includes('delay') || text.includes('던져') || text.includes('throw') || text.includes('스터터') || text.includes('stutter') || text.includes('게이트') || text.includes('gate')) {
    if (asksToMute) return patchesById(['fx-safe-mute-v0'])
    if (text.includes('임팩트') || text.includes('impact') || text.includes('쾅') || text.includes('드랍')) return patchesById(['fx-drop-impact-v0'])
    if (text.includes('딜레이') || text.includes('delay') || text.includes('던져') || text.includes('throw')) return patchesById(['fx-delay-throw-v0'])
    if (text.includes('스터터') || text.includes('stutter') || text.includes('게이트') || text.includes('gate') || text.includes('잘라')) return patchesById(['fx-stutter-gate-v0'])
    return patchesById(['fx-riser-sweep-v0'])
  }
  if (text.includes('텍스처') || text.includes('질감') || text.includes('공기') || text.includes('노이즈') || text.includes('texture') || text.includes('atmosphere')) {
    if (asksToMute) return patchesById(['texture-safe-mute-v0'])
    return patchesById(['texture-vinyl-air-v0'])
  }
  if (text.includes('패드') || text.includes('pad') || text.includes('몽환')) {
    if (text.includes('넓') || text.includes('wide') || text.includes('공간')) return patchesById(['pad-wider-v0'])
    return patchesById(['pad-wide-minor-v0'])
  }

  return []
}

export function selectDeterministicPatch(rawText: string): MusicPatch | undefined {
  return selectDeterministicPatches(rawText)[0]
}
