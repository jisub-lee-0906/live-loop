import { describe, expect, it } from 'vitest'
import { applyArrangementPlan, applyBackendCommandAction, applyLiveCodeIntent } from './apiClient'
import { createInitialLoopState } from './loopState'

describe('apiClient backend action bridge', () => {
  it('uses structured backend modify actions instead of reparsing raw text', () => {
    const state = createInitialLoopState()
    const next = applyBackendCommandAction(state, '알 수 없는 말', {
      intent: 'modify_layer',
      target: 'hats',
      value: 1,
      delta: 0.35,
      timing: 'next_bar',
    })

    expect(next.layers.hats.complexity).toBeCloseTo(0.6)
    expect(next.commandLog[0]).toMatchObject({ action: 'backend_action', target: 'hats' })
    expect(next.commandLog[0].summary).toContain('backend')
  })

  it('uses structured backend drum mute actions for all drum layers', () => {
    const state = createInitialLoopState()
    const enabled = {
      ...state,
      layers: {
        ...state.layers,
        kick: { ...state.layers.kick, enabled: true },
        snare: { ...state.layers.snare, enabled: true },
        hats: { ...state.layers.hats, enabled: true },
      },
    }

    const next = applyBackendCommandAction(enabled, 'backend only', {
      intent: 'mute_layer',
      target: 'drums',
      value: 1,
      delta: 0,
      timing: 'next_bar',
    })

    expect(next.layers.kick.enabled).toBe(false)
    expect(next.layers.snare.enabled).toBe(false)
    expect(next.layers.hats.enabled).toBe(false)
    expect(next.pendingPatch?.timing).toBe('next_bar')
  })

  it('maps structured LLM intents to multi-target patches without collapsing to one text command', () => {
    const state = createInitialLoopState()
    const next = applyLiveCodeIntent(state, '좀 풍성하게 몰아줘', {
      style: 'uk_garage',
      targets: ['drums', 'bass', 'pad'],
      constraints: ['shuffle_hats', 'wide_pad', 'rubbery_pluck'],
      timing: 'next_bar',
      confidence: 0.82,
    })

    expect(next.layers.hats.enabled).toBe(true)
    expect(next.layers.hats.subdivision).toBe('16n')
    expect(next.layers.bass.enabled).toBe(true)
    expect(next.layers.bass.macros?.preset).toBe('rubbery_pluck')
    expect(next.layers.pad.enabled).toBe(true)
    expect(next.layers.pad.macros?.preset).toBe('wide_minor_pad')
    expect(next.commandLog[0]).toMatchObject({ action: 'llm_intent_patch', target: 'pattern' })
  })

  it('maps backend ArrangementPlan responses to generated PatternDSL patches', () => {
    const state = createInitialLoopState()
    const next = applyArrangementPlan(state, '드랍 전에 숨 한번 참는 느낌으로 잘라줘', {
      intent: 'transition',
      timing: 'next_phrase',
      summary: 'parameterized transition',
      preserve: ['bass', 'kick'],
      knowledge_entry_ids: ['noise-fx-gestures'],
      confidence: 0.7,
      patches: [
        {
          target: 'fx',
          reason: 'generated tension cut',
          operations: [
            { type: 'set_enabled', value: true },
            { type: 'set_complexity', value: 0.82 },
            { type: 'set_macro', name: 'filterCutoff', value: 7600 },
            { type: 'set_pattern_events', value: [{ step: 10, voice: 'fx', velocity: 0.3, length: '16n' }] },
          ],
          shape: { type: 'tension_cut' },
        },
      ],
    }, 'rules-with-tone-knowledge')

    expect(next.layers.fx.enabled).toBe(true)
    expect(next.layers.fx.macros?.filterCutoff).toBe(7600)
    expect(next.pattern.layers.fx.events).toEqual([{ step: 10, voice: 'fx', velocity: 0.3, length: '16n' }])
    expect(next.commandLog[0]).toMatchObject({
      action: 'arrangement_plan_patch',
      target: 'fx',
      plan: {
        source: 'rules-with-tone-knowledge',
        planSummary: 'parameterized transition',
        knowledgeEntryIds: ['noise-fx-gestures'],
        preserve: ['bass', 'kick'],
        confidence: 0.7,
      },
    })
  })
})
