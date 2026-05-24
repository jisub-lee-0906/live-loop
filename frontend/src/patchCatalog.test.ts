import { describe, expect, it } from 'vitest'
import { isPatchSupported } from './instrumentCapabilities'
import { applyCommand, createInitialLoopState } from './loopState'
import { getPatchById, patchCatalog, selectDeterministicPatch, selectDeterministicPatches } from './patchCatalog'

describe('verified patch catalog v0', () => {
  it('contains only capability-supported data patches', () => {
    expect(patchCatalog.map((patch) => patch.id)).toEqual([
      'kick-tight-four-v0',
      'snare-tight-backbeat-v0',
      'hats-airy-16th-v0',
      'kick-safe-mute-v0',
      'snare-safe-mute-v0',
      'hats-safe-mute-v0',
      'bass-dark-sub-v0',
      'bass-warm-round-v0',
      'bass-rubbery-pluck-v0',
      'bass-safe-mute-v0',
      'bass-safe-unmute-v0',
      'bass-drop-return-v0',
      'pad-wide-minor-v0',
      'pad-wider-v0',
      'lead-sparkle-arp-v0',
      'lead-safe-mute-v0',
      'texture-vinyl-air-v0',
      'texture-safe-mute-v0',
      'fx-riser-sweep-v0',
      'fx-drop-impact-v0',
      'fx-delay-throw-v0',
      'fx-stutter-gate-v0',
      'fx-safe-mute-v0',
      'drums-busier-ukg-v0',
      'drums-busier-preserve-kick-v0',
      'mix-darker-bass-v0',
      'mix-darker-pad-v0',
    ])

    expect(patchCatalog.every(isPatchSupported)).toBe(true)
  })

  it('selects Korean deterministic commands into verified patches', () => {
    expect(selectDeterministicPatch('킥 깔아줘')?.id).toBe('kick-tight-four-v0')
    expect(selectDeterministicPatch('하이햇 얹어줘 살짝 셔플')?.id).toBe('hats-airy-16th-v0')
    expect(selectDeterministicPatch('어두운 베이스 넣어줘')?.id).toBe('bass-dark-sub-v0')
    expect(selectDeterministicPatch('베이스 둥글게 넣어줘')?.id).toBe('bass-warm-round-v0')
    expect(selectDeterministicPatch('베이스 잠깐 빼')?.id).toBe('bass-safe-mute-v0')
    expect(selectDeterministicPatch('몽환적인 패드 깔아줘')?.id).toBe('pad-wide-minor-v0')
    expect(selectDeterministicPatch('패드 넓게 깔아줘')?.id).toBe('pad-wider-v0')
    expect(selectDeterministicPatch('위에 반짝이는 아르페지오 살짝')?.id).toBe('lead-sparkle-arp-v0')
    expect(selectDeterministicPatch('공기감 있는 노이즈 질감 깔아줘')?.id).toBe('texture-vinyl-air-v0')
    expect(selectDeterministicPatch('다음 전환 전에 라이저 효과 넣어줘')?.id).toBe('fx-riser-sweep-v0')
    expect(selectDeterministicPatch('드랍 임팩트 쾅 넣어줘')?.id).toBe('fx-drop-impact-v0')
    expect(selectDeterministicPatch('마지막 소리 딜레이로 던져줘')?.id).toBe('fx-delay-throw-v0')
    expect(selectDeterministicPatch('전환 전에 스터터 게이트로 잘라줘')?.id).toBe('fx-stutter-gate-v0')
    expect(selectDeterministicPatch('드럼 좀 더 쪼개줘')?.id).toBe('drums-busier-ukg-v0')
  })

  it('selects MVP composite commands into verified patch chains', () => {
    expect(selectDeterministicPatches('전체 좀 어둡게').map((patch) => patch.id)).toEqual(['mix-darker-bass-v0', 'mix-darker-pad-v0'])
    expect(selectDeterministicPatches('다시 드랍').map((patch) => patch.id)).toEqual(['bass-drop-return-v0', 'drums-busier-preserve-kick-v0'])
    expect(selectDeterministicPatches('드럼비트 추가해줘').map((patch) => patch.id)).toEqual([
      'kick-tight-four-v0',
      'snare-tight-backbeat-v0',
      'hats-airy-16th-v0',
    ])
    expect(selectDeterministicPatches('드럼비트 꺼줘').map((patch) => patch.id)).toEqual([
      'kick-safe-mute-v0',
      'snare-safe-mute-v0',
      'hats-safe-mute-v0',
    ])
  })

  it('routes common applyCommand layer changes through MusicPatch', () => {
    const withBass = applyCommand(createInitialLoopState(), '어두운 베이스 넣어줘')
    const muted = applyCommand(withBass, '베이스 빼줘')

    expect(withBass.commandLog[0]?.action).toBe('music_patch')
    expect(withBass.pendingPatch?.id).toBe('bass-dark-sub-v0')
    expect(withBass.layers.bass.macros?.preset).toBe('dark_sub')
    expect(muted.commandLog[0]?.action).toBe('music_patch')
    expect(muted.pendingPatch?.id).toBe('bass-safe-mute-v0')
    expect(muted.layers.bass.enabled).toBe(false)
  })

  it('adds lead as an ensemble role instead of a fixed five-layer ceiling', () => {
    const withLead = applyCommand(createInitialLoopState(), '위에 반짝이는 아르페지오 살짝')
    const muted = applyCommand(withLead, '멜로디 빼줘')

    expect(withLead.pendingPatch?.id).toBe('lead-sparkle-arp-v0')
    expect(withLead.layers.lead.enabled).toBe(true)
    expect(withLead.layers.lead.macros?.preset).toBe('sparkle_arp')
    expect(muted.pendingPatch?.id).toBe('lead-safe-mute-v0')
    expect(muted.layers.lead.enabled).toBe(false)
  })

  it('adds texture as an ensemble role for atmospheric arrangement commands', () => {
    const withTexture = applyCommand(createInitialLoopState(), '공기감 있는 노이즈 질감 깔아줘')
    const muted = applyCommand(withTexture, '텍스처 빼줘')

    expect(withTexture.pendingPatch?.id).toBe('texture-vinyl-air-v0')
    expect(withTexture.layers.texture.enabled).toBe(true)
    expect(withTexture.layers.texture.macros?.preset).toBe('vinyl_air')
    expect(muted.pendingPatch?.id).toBe('texture-safe-mute-v0')
    expect(muted.layers.texture.enabled).toBe(false)
  })

  it('adds FX as an ensemble role for transition arrangement commands', () => {
    const withFx = applyCommand(createInitialLoopState(), '다음 전환 전에 라이저 효과 넣어줘')
    const muted = applyCommand(withFx, 'fx 빼줘')

    expect(withFx.pendingPatch?.id).toBe('fx-riser-sweep-v0')
    expect(withFx.layers.fx.enabled).toBe(true)
    expect(withFx.layers.fx.macros?.preset).toBe('riser_sweep')
    expect(withFx.pattern.layers.fx.events.map((event) => event.step)).toEqual([15])

    const impact = applyCommand(withFx, '드랍 임팩트 쾅 넣어줘')
    const throwFx = applyCommand(withFx, '마지막 소리 딜레이로 던져줘')
    const stutter = applyCommand(withFx, '전환 전에 스터터 게이트로 잘라줘')
    expect(impact.layers.fx.macros?.preset).toBe('drop_impact')
    expect(impact.pattern.layers.fx.events.map((event) => event.step)).toEqual([0])
    expect(throwFx.layers.fx.macros?.preset).toBe('delay_throw')
    expect(throwFx.pattern.layers.fx.events.map((event) => event.step)).toEqual([14, 15])
    expect(stutter.layers.fx.macros?.preset).toBe('stutter_gate')
    expect(stutter.pattern.layers.fx.events.map((event) => event.step)).toEqual([12, 13, 14, 15])
    expect(muted.pendingPatch?.id).toBe('fx-safe-mute-v0')
    expect(muted.layers.fx.enabled).toBe(false)
  })

  it('keeps catalog lookup immutable for callers', () => {
    const patch = getPatchById('bass-dark-sub-v0')

    expect(patch?.operations).toContainEqual({ type: 'set_macro', name: 'filterCutoff', value: 420 })
    patch?.operations.push({ type: 'set_macro', name: 'filterCutoff', value: 5000 })
    expect(getPatchById('bass-dark-sub-v0')?.operations).toHaveLength(6)
  })
})
