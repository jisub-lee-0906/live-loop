import { describe, expect, it } from 'vitest'
import { createDebugPlanSummary } from './debugPlanSummary'
import { createInitialLoopState } from './loopState'
import type { LoopState } from './loopState'

describe('createDebugPlanSummary', () => {
  it('shows a silent empty initial plan without pretending audio exists', () => {
    const summary = createDebugPlanSummary(createInitialLoopState())

    expect(summary.command).toBe('no command yet')
    expect(summary.source).toBe('local/deterministic')
    expect(summary.knowledge).toBe('none')
    expect(summary.preserve).toBe('none')
    expect(summary.intent).toBe('E0 T0 D0 S0.35 P0 · silence')
    expect(summary.pending).toBe('none')
    expect(summary.activeLayers).toBe('silent')
    expect(summary.fxAutomation).toBe('none')
    expect(summary.fxEvents).toContain('0:fx@0.54/4n')
  })

  it('renders generated fx PatternDSL events and automation curves for debug preview', () => {
    const state: LoopState = {
      ...createInitialLoopState(),
      layers: {
        ...createInitialLoopState().layers,
        fx: { ...createInitialLoopState().layers.fx, enabled: true, volume: 0.42 },
      },
      pattern: {
        ...createInitialLoopState().pattern,
        layers: {
          ...createInitialLoopState().pattern.layers,
          fx: {
            ...createInitialLoopState().pattern.layers.fx,
            events: [
              { step: 12, voice: 'fx', velocity: 0.2, length: '16n' },
              { step: 15, voice: 'fx', velocity: 0.8, length: '16n' },
            ],
            automation: [
              { parameter: 'gate', start_step: 12, end_step: 16, start_value: 0, end_value: 1, shape: 'rising' },
              { parameter: 'filterCutoff', start_step: 12, end_step: 16, start_value: 800, end_value: 5400, shape: 'linear' },
            ],
          },
        },
      },
      pendingPatch: { id: 'generated-transition', label: 'Generated Transition', target: 'fx', timing: 'next_bar' },
      commandLog: [
        {
          id: 1,
          text: '드랍 전에 숨 참는 느낌',
          action: 'music_patch',
          target: 'fx',
          summary: 'Generated Transition 패치를 다음 안전 지점에 예약했어요',
          plan: {
            source: 'rules-with-tone-knowledge',
            planSummary: 'Tone.js knowledge-assisted parameterized arrangement plan',
            knowledgeEntryIds: ['noise-fx-gestures', 'safe-transport-scheduling'],
            preserve: ['kick', 'bass'],
            confidence: 0.7,
          },
        },
      ],
    }

    const summary = createDebugPlanSummary(state)

    expect(summary.command).toBe('music_patch → fx: Generated Transition 패치를 다음 안전 지점에 예약했어요')
    expect(summary.source).toBe('rules-with-tone-knowledge · conf 0.7 · Tone.js knowledge-assisted parameterized arrangement plan')
    expect(summary.knowledge).toBe('noise-fx-gestures · safe-transport-scheduling')
    expect(summary.preserve).toBe('kick · bass')
    expect(summary.intent).toBe('E0 T0 D0 S0.35 P0 · silence')
    expect(summary.pending).toBe('Generated Transition → fx @ next_bar')
    expect(summary.activeLayers).toBe('fx:0.42')
    expect(summary.fxEvents).toBe('12:fx@0.2/16n · 15:fx@0.8/16n')
    expect(summary.fxAutomation).toBe('gate 12-16 0→1 rising · filterCutoff 12-16 800→5400 linear')
  })
})
