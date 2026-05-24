export type PatternLayerId = 'drums' | 'bass' | 'pad' | 'lead' | 'texture' | 'fx'
export type PatternVoice = 'kick' | 'snare' | 'hat' | 'bass' | 'pad' | 'lead' | 'texture' | 'fx'
export type NoteLength = '16n' | '8n' | '4n' | '2n' | '1m'

export interface PatternEvent {
  step: number
  voice: PatternVoice
  velocity: number
  note?: string
  length?: NoteLength
}

export type AutomationParameter = 'filterCutoff' | 'reverbWet' | 'delayWet' | 'volume' | 'gate'
export type AutomationShape = 'linear' | 'exponential' | 'rising' | 'falling' | 'pulse'

export interface AutomationCurve {
  parameter: AutomationParameter
  start_step: number
  end_step: number
  start_value: number
  end_value: number
  shape: AutomationShape
}

export interface PatternLayer {
  id: PatternLayerId
  label: string
  steps: number
  swing: number
  sound: string
  events: PatternEvent[]
  automation?: AutomationCurve[]
}

export interface LiveCodePattern {
  id: string
  name: string
  bpm: number
  key: string
  description: string
  layers: Record<PatternLayerId, PatternLayer>
}

export interface LiveCodeIntent {
  style: 'house' | 'uk_garage' | 'techno' | 'ambient'
  targets: Array<'drums' | 'bass' | 'pad' | 'lead' | 'texture' | 'fx' | 'mix'>
  constraints: string[]
  timing: 'now' | 'next_step' | 'next_bar'
  confidence: number
}

function event(step: number, voice: PatternVoice, velocity: number, note?: string, length?: NoteLength): PatternEvent {
  return { step, voice, velocity, note, length }
}

export function resolveStepEvents(layer: PatternLayer, step: number): PatternEvent[] {
  const normalized = ((Math.trunc(step) % layer.steps) + layer.steps) % layer.steps
  return layer.events.filter((item) => item.step === normalized)
}

export function createHousePattern(): LiveCodePattern {
  return {
    id: 'house-groove',
    name: 'House Groove',
    bpm: 124,
    key: 'C minor',
    description: '단단한 4-on-the-floor 킥, 백비트 스네어, 오프비트 베이스를 가진 기본 하우스 라이브코드 패턴',
    layers: {
      drums: {
        id: 'drums',
        label: 'Drums',
        steps: 16,
        swing: 0.5,
        sound: 'tight_house_kit',
        events: [
          ...[0, 4, 8, 12].map((step) => event(step, 'kick', step === 0 ? 1 : 0.88)),
          event(4, 'snare', 0.86),
          event(12, 'snare', 0.86),
          ...Array.from({ length: 8 }, (_, index) => event(index * 2 + 1, 'hat', index % 2 === 0 ? 0.42 : 0.58)),
        ],
      },
      bass: {
        id: 'bass',
        label: 'Bass',
        steps: 16,
        swing: 0.5,
        sound: 'bass_pluck',
        events: [event(2, 'bass', 0.9, 'C2', '16n'), event(6, 'bass', 0.72, 'Eb2', '16n'), event(10, 'bass', 0.86, 'G1', '8n'), event(14, 'bass', 0.68, 'Bb1', '16n')],
      },
      pad: {
        id: 'pad',
        label: 'Pad',
        steps: 16,
        swing: 0.5,
        sound: 'wide_minor_pad',
        events: [event(0, 'pad', 0.34, 'Cm7', '1m')],
      },
      lead: {
        id: 'lead',
        label: 'Lead',
        steps: 16,
        swing: 0.5,
        sound: 'sparkle_arp',
        events: [event(1, 'lead', 0.32, 'G4', '16n'), event(5, 'lead', 0.28, 'Bb4', '16n'), event(9, 'lead', 0.34, 'D5', '16n'), event(13, 'lead', 0.25, 'Eb5', '16n')],
      },
      texture: {
        id: 'texture',
        label: 'Texture',
        steps: 16,
        swing: 0.5,
        sound: 'vinyl_air',
        events: [event(0, 'texture', 0.28, undefined, '2n'), event(8, 'texture', 0.2, undefined, '2n')],
      },
      fx: {
        id: 'fx',
        label: 'FX',
        steps: 16,
        swing: 0.5,
        sound: 'transition_fx',
        events: [event(0, 'fx', 0.54, undefined, '4n'), event(12, 'fx', 0.24, undefined, '16n'), event(13, 'fx', 0.18, undefined, '16n'), event(14, 'fx', 0.34, undefined, '16n'), event(15, 'fx', 0.42, undefined, '16n')],
      },
    },
  }
}

export function createUkGaragePattern(): LiveCodePattern {
  return {
    id: 'ukg-shuffle',
    name: 'UK Garage Shuffle',
    bpm: 130,
    key: 'C minor',
    description: '셔플 하이햇과 당겨 치는 킥으로 더 튀는 UK garage 느낌의 라이브코드 패턴',
    layers: {
      drums: {
        id: 'drums',
        label: 'Drums',
        steps: 16,
        swing: 0.59,
        sound: 'shuffled_garage_kit',
        events: [
          event(0, 'kick', 1),
          event(7, 'kick', 0.62),
          event(11, 'kick', 0.48),
          event(4, 'snare', 0.94),
          event(12, 'snare', 0.96),
          event(3, 'snare', 0.26),
          event(15, 'snare', 0.22),
          ...[1, 3, 5, 7, 9, 11, 13, 15].map((step, index) => event(step, 'hat', index % 2 === 0 ? 0.36 : 0.64)),
        ],
      },
      bass: {
        id: 'bass',
        label: 'Bass',
        steps: 16,
        swing: 0.59,
        sound: 'rubbery_sub_pluck',
        events: [event(2, 'bass', 0.82, 'C2', '16n'), event(5, 'bass', 0.62, 'G1', '16n'), event(9, 'bass', 0.86, 'Eb2', '8n'), event(14, 'bass', 0.74, 'Bb1', '16n')],
      },
      pad: {
        id: 'pad',
        label: 'Pad',
        steps: 16,
        swing: 0.59,
        sound: 'filtered_chord_stab',
        events: [event(0, 'pad', 0.28, 'Cm9', '1m')],
      },
      lead: {
        id: 'lead',
        label: 'Lead',
        steps: 16,
        swing: 0.59,
        sound: 'syncopated_sparkle_arp',
        events: [event(3, 'lead', 0.3, 'G4', '16n'), event(6, 'lead', 0.24, 'C5', '16n'), event(10, 'lead', 0.34, 'D5', '16n'), event(15, 'lead', 0.26, 'Bb4', '16n')],
      },
      texture: {
        id: 'texture',
        label: 'Texture',
        steps: 16,
        swing: 0.59,
        sound: 'vinyl_air',
        events: [event(0, 'texture', 0.24, undefined, '2n'), event(8, 'texture', 0.18, undefined, '2n')],
      },
      fx: {
        id: 'fx',
        label: 'FX',
        steps: 16,
        swing: 0.59,
        sound: 'riser_sweep',
        events: [event(15, 'fx', 0.46, undefined, '16n')],
      },
    },
  }
}

function eventListToCode(layer: PatternLayer, voice: PatternVoice): string {
  const events = layer.events.filter((item) => item.voice === voice)
  if (events.length === 0) return ''
  const rendered = events.map((item) => (item.note ? `{ step: ${item.step}, note: ${item.note}, velocity: ${item.velocity} }` : `{ step: ${item.step}, velocity: ${item.velocity} }`)).join(', ')
  const command = voice === 'bass' || voice === 'pad' ? 'synth' : 'sample'
  const instrument = command === 'synth' ? layer.sound : voice
  return `  ${command} ${instrument} [${rendered}]`
}

export function patternToLiveCode(pattern: LiveCodePattern): string {
  const lines = [`live_loop "${pattern.name.toLowerCase()}" {`, `  bpm ${pattern.bpm}`, `  key "${pattern.key}"`, '']
  for (const layer of Object.values(pattern.layers)) {
    lines.push(`  layer "${layer.id}" {`)
    lines.push(`    sound "${layer.sound}"`)
    lines.push(`    steps ${layer.steps}`)
    lines.push(`    swing ${layer.swing}`)
    for (const voice of ['kick', 'snare', 'hat', 'bass', 'pad', 'lead', 'texture', 'fx'] as PatternVoice[]) {
      const code = eventListToCode(layer, voice)
      if (code) lines.push(code)
    }
    lines.push('  }')
    lines.push('')
  }
  lines.push('}')
  return lines.join('\n')
}

export function mockLiveCodeCommand(text: string): LiveCodePattern {
  const lower = text.toLowerCase()
  if (lower.includes('garage') || lower.includes('개러지') || lower.includes('uk')) return createUkGaragePattern()
  return createHousePattern()
}

export function createPatternFromIntent(intent: LiveCodeIntent): LiveCodePattern {
  if (intent.style === 'uk_garage' || intent.constraints.includes('shuffle_hats')) return createUkGaragePattern()
  return createHousePattern()
}
