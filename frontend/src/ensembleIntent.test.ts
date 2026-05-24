import { describe, expect, it } from 'vitest'
import { isPatchSupported } from './instrumentCapabilities'
import { ensemblePatchesFromIntent } from './ensembleIntent'
import { interpretMusicalIntentCommand } from './musicalIntent'

describe('role-based ensemble intent bridge', () => {
  it('turns withhold intent into silence/FX/texture plans without impact or lead entry', () => {
    const intent = interpretMusicalIntentCommand('아직 터뜨리지 말고 숨 참아')
    const patches = ensemblePatchesFromIntent(intent)

    expect(patches.map((patch) => patch.target)).toEqual(['fx', 'texture'])
    expect(patches.every(isPatchSupported)).toBe(true)
    expect(patches[0]).toMatchObject({ id: 'intent-withhold-fx-v0', timing: 'next_phrase', target: 'fx' })
    expect(patches[0].operations).not.toContainEqual(expect.objectContaining({ type: 'set_macro', name: 'preset', value: 'drop_impact' }))
    expect(patches[0].operations).toContainEqual(expect.objectContaining({ type: 'set_pattern_events' }))
  })

  it('turns release intent into a bounded drop/release punctuation plan', () => {
    const intent = interpretMusicalIntentCommand('이제 터뜨려')
    const patches = ensemblePatchesFromIntent(intent)

    expect(patches.map((patch) => patch.target)).toContain('fx')
    expect(patches.every(isPatchSupported)).toBe(true)
    expect(patches[0]).toMatchObject({ id: 'intent-release-fx-v0', timing: 'next_bar', target: 'fx' })
    expect(patches[0].operations).toContainEqual(expect.objectContaining({ type: 'set_macro', name: 'preset', value: 'drop_impact' }))
  })

  it('turns carve-space intent into lower-density surface layers while preserving anchors', () => {
    const intent = interpretMusicalIntentCommand('비워')
    const patches = ensemblePatchesFromIntent(intent)

    expect(patches.map((patch) => patch.target)).toEqual(['hats', 'lead', 'texture'])
    expect(patches.every(isPatchSupported)).toBe(true)
    expect(patches.find((patch) => patch.target === 'hats')?.operations).toContainEqual({ type: 'set_volume', value: 0.28 })
    expect(patches.find((patch) => patch.target === 'lead')?.operations).toContainEqual({ type: 'set_enabled', value: false })
  })
})
