import * as Tone from 'tone'
import { resolveStepEvents, type PatternEvent } from './patternDsl'
import type { LoopState } from './loopState'
import type { TransportPosition } from './quantizedScheduler'
import { drumSamples } from './sampleManifest'

export type ScheduledUpdateId = number

export interface ScheduledUpdateInfo {
  id: ScheduledUpdateId
  transportTime: string
}

export interface LiveLoopEngine {
  start(): Promise<void>
  stop(): void
  update(state: LoopState): void
  scheduleUpdateAtBar(state: LoopState, applyAtBar: number, onApplied?: () => void): ScheduledUpdateInfo
  cancelScheduledUpdate(id: ScheduledUpdateId): void
  getAnalyser(): Tone.Analyser
  getAudioNode(): AudioNode
  getStatus(): AudioEngineStatus
  getTransportPosition(): TransportPosition
  preview(): Promise<void>
  dispose(): void
}

export interface AudioEngineStatus {
  contextState: string
  transportState: string
  kickLoaded: boolean
  snareLoaded: boolean
  hatLoaded: boolean
}

export function createLiveLoopEngine(): LiveLoopEngine {
  const analyser = new Tone.Analyser('waveform', 128)
  const master = new Tone.Gain(0.72).toDestination()
  master.connect(analyser)
  const drumBus = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.006, release: 0.12 }).connect(master)

  const kick = new Tone.Player(drumSamples.kick).connect(drumBus)
  const snare = new Tone.Player(drumSamples.snare).connect(drumBus)
  const hats = new Tone.Player(drumSamples.hat).connect(drumBus)
  const kickFallback = new Tone.MembraneSynth({
    pitchDecay: 0.045,
    octaves: 8,
    envelope: { attack: 0.001, decay: 0.32, sustain: 0.01, release: 0.8 },
  }).connect(drumBus)
  const snareFallback = new Tone.NoiseSynth({
    envelope: { attack: 0.001, decay: 0.16, sustain: 0.02, release: 0.08 },
  }).connect(drumBus)
  const hatFallback = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
    harmonicity: 5.1,
    modulationIndex: 24,
    resonance: 4200,
    octaves: 1.5,
  }).connect(drumBus)
  const previewSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.2, release: 0.2 },
  }).connect(master)
  const bass = new Tone.MonoSynth({
    oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
    filter: { Q: 2.2, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.006, decay: 0.22, sustain: 0.22, release: 0.14 },
    filterEnvelope: { attack: 0.006, decay: 0.2, sustain: 0.12, release: 0.12, baseFrequency: 58, octaves: 3.1 },
  }).connect(master)
  const reverb = new Tone.Reverb({ decay: 3.8, wet: 0.28 }).connect(master)
  const pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fattriangle', count: 3, spread: 24 },
    envelope: { attack: 0.7, decay: 0.3, sustain: 0.52, release: 2.2 },
  }).connect(reverb)

  let currentState: LoopState
  let step = 0

  function playKick(time: number, gain: number) {
    if (kick.loaded) {
      kick.volume.value = Tone.gainToDb(gain * 1.15)
      kick.start(time)
      return
    }
    kickFallback.volume.value = Tone.gainToDb(gain)
    kickFallback.triggerAttackRelease('C1', '8n', time)
  }

  function playSnare(time: number, gain: number) {
    if (snare.loaded) {
      snare.volume.value = Tone.gainToDb(gain * 0.82)
      snare.start(time)
      return
    }
    snareFallback.volume.value = Tone.gainToDb(gain * 0.72)
    snareFallback.triggerAttackRelease('16n', time)
  }

  function playHat(time: number, gain: number) {
    if (hats.loaded) {
      hats.volume.value = Tone.gainToDb(gain * 0.45)
      hats.start(time)
      return
    }
    hatFallback.volume.value = Tone.gainToDb(gain * 0.32)
    hatFallback.triggerAttackRelease('32n', time)
  }

  function playPatternEvent(event: PatternEvent, time: number) {
    const s = currentState
    if (!s) return
    if (event.voice === 'kick' && s.layers.kick.enabled) playKick(time, s.layers.kick.volume * event.velocity)
    if (event.voice === 'snare' && s.layers.snare.enabled) playSnare(time, s.layers.snare.volume * event.velocity)
    if (event.voice === 'hat' && s.layers.hats.enabled) playHat(time, s.layers.hats.volume * event.velocity)
    if (event.voice === 'bass' && s.layers.bass.enabled && event.note) {
      bass.volume.value = Tone.gainToDb(s.layers.bass.volume * event.velocity * 0.6)
      bass.triggerAttackRelease(event.note, event.length ?? '8n', time)
    }
    if (event.voice === 'pad' && s.layers.pad.enabled && event.note) {
      pad.volume.value = Tone.gainToDb(s.layers.pad.volume * event.velocity * 0.28)
      pad.triggerAttackRelease(chordToNotes(event.note), event.length ?? '1m', time)
    }
  }

  function chordToNotes(chord: string): string[] {
    if (chord.startsWith('Cm9')) return ['C3', 'Eb3', 'G3', 'Bb3', 'D4']
    if (chord.startsWith('Cm7')) return ['C3', 'Eb3', 'G3', 'Bb3']
    return ['C3', 'Eb3', 'G3']
  }

  function getTransportPosition(): TransportPosition {
    const raw = String(Tone.Transport.position)
    const [barsRaw = '0', beatsRaw = '0', sixteenthsRaw = '0'] = raw.split(':')
    return {
      bpm: currentState?.bpm ?? Tone.Transport.bpm.value,
      bar: Number.parseInt(barsRaw, 10) + 1,
      beat: Number.parseInt(beatsRaw, 10) + 1,
      sixteenth: Math.floor(Number.parseFloat(sixteenthsRaw)) + 1,
      seconds: Tone.Transport.seconds,
      isPlaying: Tone.Transport.state === 'started',
    }
  }

  function applyStateAtAudioBoundary(state: LoopState) {
    currentState = state
    Tone.Transport.bpm.rampTo(state.bpm, 0.08)
  }

  function barToTransportTime(applyAtBar: number): string {
    return `${Math.max(0, Math.trunc(applyAtBar) - 1)}:0:0`
  }

  const loops = [
    new Tone.Loop((time) => {
      const s = currentState
      if (!s) return
      for (const layer of Object.values(s.pattern.layers)) {
        for (const event of resolveStepEvents(layer, step)) {
          playPatternEvent(event, time)
        }
      }
      step = (step + 1) % s.pattern.layers.drums.steps
    }, '16n'),
  ]

  return {
    async start() {
      await Tone.start()
      await Tone.getContext().resume()
      void Tone.loaded()
      step = 0
      Tone.Transport.bpm.value = currentState?.bpm ?? 124
      loops.forEach((loop) => loop.start(0))
      Tone.Transport.start()
      previewSynth.triggerAttackRelease('C5', '16n', Tone.now() + 0.02)
    },
    stop() {
      Tone.Transport.stop()
      Tone.Transport.cancel()
      loops.forEach((loop) => loop.stop())
      step = 0
    },
    update(state: LoopState) {
      applyStateAtAudioBoundary(state)
    },
    scheduleUpdateAtBar(state: LoopState, applyAtBar: number, onApplied?: () => void) {
      const transportTime = barToTransportTime(applyAtBar)
      const id = Tone.Transport.scheduleOnce(() => {
        applyStateAtAudioBoundary(state)
        onApplied?.()
      }, transportTime)
      return { id, transportTime }
    },
    cancelScheduledUpdate(id: ScheduledUpdateId) {
      Tone.Transport.clear(id)
    },
    getAnalyser() {
      return analyser
    },
    getAudioNode() {
      return (master as unknown as { output: AudioNode }).output
    },
    getStatus() {
      return {
        contextState: Tone.getContext().state,
        transportState: Tone.Transport.state,
        kickLoaded: kick.loaded,
        snareLoaded: snare.loaded,
        hatLoaded: hats.loaded,
      }
    },
    getTransportPosition() {
      return getTransportPosition()
    },
    async preview() {
      await Tone.start()
      await Tone.getContext().resume()
      previewSynth.triggerAttackRelease('A4', '8n', Tone.now() + 0.02)
      playKick(Tone.now() + 0.16, 0.85)
    },
    dispose() {
      this.stop()
      loops.forEach((loop) => loop.dispose())
      ;[
        kick,
        snare,
        hats,
        kickFallback,
        snareFallback,
        hatFallback,
        previewSynth,
        bass,
        pad,
        reverb,
        drumBus,
        master,
        analyser,
      ].forEach((node) => node.dispose())
    },
  }
}
