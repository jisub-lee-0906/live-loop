import * as Tone from 'tone'
import { resolveRuntimeParams, type LoopRuntimeParams } from './audioRuntimeParams'
import { resolveAutomationValueAtStep, resolveFxGesturePlayback } from './fxGesture'
import type { PatternEvent } from './patternDsl'
import { resolvePlaybackStepEvents } from './playbackEvents'
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
  resume(): Promise<void>
  pause(): void
  stop(): void
  panic(): void
  update(state: LoopState): void
  setListeningDucking(ducked: boolean): void
  scheduleUpdateAtBar(state: LoopState, applyAtBar: number, onApplied?: () => void): ScheduledUpdateInfo
  cancelScheduledUpdate(id: ScheduledUpdateId): void
  getAnalyser(): Tone.Analyser
  getAudioNode(): AudioNode
  getStatus(): AudioEngineStatus
  getTransportPosition(): TransportPosition
  unlockAudio(): Promise<void>
  preview(): Promise<void>
  dispose(): void
}

export interface AudioEngineStatus {
  contextState: string
  transportState: string
  kickLoaded: boolean
  snareLoaded: boolean
  hatLoaded: boolean
  listeningDucked: boolean
}

export function createLiveLoopEngine(): LiveLoopEngine {
  const analyser = new Tone.Analyser('waveform', 128)
  const master = new Tone.Gain(0.72).toDestination()
  master.connect(analyser)
  const drumBus = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.006, release: 0.12 }).connect(master)
  const snareReverb = new Tone.Reverb({ decay: 1.4, wet: 1 }).connect(master)
  const snareReverbSend = new Tone.Gain(0).connect(snareReverb)

  const kick = new Tone.Player(drumSamples.kick).connect(drumBus)
  const snare = new Tone.Player(drumSamples.snare).connect(drumBus)
  snare.connect(snareReverbSend)
  const hats = new Tone.Player(drumSamples.hat).connect(drumBus)
  const kickFallback = new Tone.MembraneSynth({
    pitchDecay: 0.045,
    octaves: 8,
    envelope: { attack: 0.001, decay: 0.32, sustain: 0.01, release: 0.8 },
  }).connect(drumBus)
  const snareFallback = new Tone.NoiseSynth({
    envelope: { attack: 0.001, decay: 0.16, sustain: 0.02, release: 0.08 },
  }).connect(drumBus)
  snareFallback.connect(snareReverbSend)
  const hatFallback = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
    harmonicity: 5.1,
    modulationIndex: 24,
    resonance: 4200,
    octaves: 1.5,
  }).connect(drumBus)
  const bass = new Tone.MonoSynth({
    oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
    filter: { Q: 2.2, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.006, decay: 0.22, sustain: 0.22, release: 0.14 },
    filterEnvelope: { attack: 0.006, decay: 0.2, sustain: 0.12, release: 0.12, baseFrequency: 58, octaves: 3.1 },
  }).connect(master)
  const subBass = new Tone.MonoSynth({
    oscillator: { type: 'sine' },
    filter: { Q: 0.8, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.004, decay: 0.12, sustain: 0.34, release: 0.12 },
    filterEnvelope: { attack: 0.004, decay: 0.1, sustain: 0.2, release: 0.1, baseFrequency: 44, octaves: 1.2 },
  }).connect(master)
  const reverb = new Tone.Reverb({ decay: 3.8, wet: 0.28 }).connect(master)
  const padFilter = new Tone.Filter(1800, 'lowpass').connect(reverb)
  const pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fattriangle', count: 3, spread: 24 },
    envelope: { attack: 0.7, decay: 0.3, sustain: 0.52, release: 2.2 },
  }).connect(padFilter)
  const leadDelay = new Tone.PingPongDelay({ delayTime: '8n', feedback: 0.28, wet: 0.22 }).connect(master)
  const leadReverb = new Tone.Reverb({ decay: 2.6, wet: 0.3 }).connect(leadDelay)
  const leadFilter = new Tone.Filter(5200, 'lowpass').connect(leadReverb)
  const lead = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 2.7,
    modulationIndex: 7,
    envelope: { attack: 0.006, decay: 0.08, sustain: 0.08, release: 0.18 },
    modulationEnvelope: { attack: 0.004, decay: 0.12, sustain: 0.02, release: 0.12 },
  }).connect(leadFilter)
  const textureReverb = new Tone.Reverb({ decay: 5.2, wet: 0.56 }).connect(master)
  const textureFilter = new Tone.Filter(2600, 'bandpass').connect(textureReverb)
  const texture = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.9, decay: 0.2, sustain: 0.18, release: 3.8 },
  }).connect(textureFilter)
  const fxDelay = new Tone.PingPongDelay({ delayTime: '16n', feedback: 0.18, wet: 0.12 }).connect(master)
  const fxReverb = new Tone.Reverb({ decay: 3.4, wet: 0.42 }).connect(fxDelay)
  const fxFilter = new Tone.Filter(1200, 'highpass').connect(fxReverb)
  const fx = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.05, decay: 0.18, sustain: 0.06, release: 1.2 },
  }).connect(fxFilter)

  let currentState: LoopState
  let currentRuntimeParams: LoopRuntimeParams | undefined
  let step = 0
  let listeningDucked = false

  function playKick(time: number, gain: number) {
    const params = currentRuntimeParams?.kick
    const shapedGain = gain * (params?.volumeScale ?? 1) * (1 + (params?.drive ?? 0) * 0.18)
    if (kick.loaded) {
      kick.volume.value = Tone.gainToDb(shapedGain * 1.15)
      kick.start(time)
      return
    }
    kickFallback.volume.value = Tone.gainToDb(shapedGain)
    kickFallback.triggerAttackRelease('C1', '8n', time)
  }

  function playSnare(time: number, gain: number) {
    const params = currentRuntimeParams?.snare
    const shapedGain = gain * (params?.volumeScale ?? 1)
    if (snare.loaded) {
      snare.volume.value = Tone.gainToDb(shapedGain * 0.82)
      snare.start(time)
      return
    }
    snareFallback.volume.value = Tone.gainToDb(shapedGain * 0.72)
    snareFallback.triggerAttackRelease('16n', time)
  }

  function playHat(time: number, gain: number) {
    const params = currentRuntimeParams?.hats
    const shapedGain = gain * (params?.volumeScale ?? 1) * (0.85 + (params?.brightness ?? 0.5) * 0.3)
    if (hats.loaded) {
      hats.volume.value = Tone.gainToDb(shapedGain * 0.45)
      hats.start(time)
      return
    }
    hatFallback.volume.value = Tone.gainToDb(shapedGain * 0.32)
    hatFallback.triggerAttackRelease('C6', params?.release && params.release > 0.06 ? '16n' : '32n', time)
  }

  function playPatternEvent(event: PatternEvent, time: number) {
    const s = currentState
    if (!s) return
    if (event.voice === 'kick' && s.layers.kick.enabled) playKick(time, s.layers.kick.volume * event.velocity)
    if (event.voice === 'snare' && s.layers.snare.enabled) playSnare(time, s.layers.snare.volume * event.velocity)
    if (event.voice === 'hat' && s.layers.hats.enabled) playHat(time, s.layers.hats.volume * event.velocity)
    if (event.voice === 'bass' && s.layers.bass.enabled && event.note) {
      const params = currentRuntimeParams?.bass ?? resolveRuntimeParams(s).bass
      bass.volume.value = Tone.gainToDb(s.layers.bass.volume * event.velocity * 0.6 * params.volumeScale * (1 + params.drive * 0.12))
      bass.triggerAttackRelease(event.note, event.length ?? '8n', time)
      if (params.subOsc) {
        subBass.volume.value = Tone.gainToDb(s.layers.bass.volume * event.velocity * 0.28 * params.volumeScale)
        subBass.triggerAttackRelease(event.note.replace(/\d$/, '1'), event.length ?? '8n', time)
      }
    }
    if (event.voice === 'pad' && s.layers.pad.enabled && event.note) {
      const params = currentRuntimeParams?.pad ?? resolveRuntimeParams(s).pad
      pad.volume.value = Tone.gainToDb(s.layers.pad.volume * event.velocity * 0.28 * params.volumeScale)
      pad.triggerAttackRelease(chordToNotes(event.note), event.length ?? '1m', time)
    }
    if (event.voice === 'lead' && s.layers.lead.enabled && event.note) {
      const params = currentRuntimeParams?.lead ?? resolveRuntimeParams(s).lead
      lead.volume.value = Tone.gainToDb(s.layers.lead.volume * event.velocity * 0.42 * params.volumeScale)
      lead.triggerAttackRelease(event.note, event.length ?? '16n', time)
    }
    if (event.voice === 'texture' && s.layers.texture.enabled) {
      const params = currentRuntimeParams?.texture ?? resolveRuntimeParams(s).texture
      texture.volume.value = Tone.gainToDb(s.layers.texture.volume * event.velocity * 0.32 * params.volumeScale)
      texture.triggerAttackRelease(event.length ?? '2n', time)
    }
    if (event.voice === 'fx' && s.layers.fx.enabled) {
      const params = currentRuntimeParams?.fx ?? resolveRuntimeParams(s).fx
      const automation = s.pattern.layers.fx.automation
      const gateScale = resolveAutomationValueAtStep(automation, 'gate', event.step, 1)
      const filterScale = resolveAutomationValueAtStep(automation, 'filterCutoff', event.step, params.filterCutoff) / params.filterCutoff
      const gesture = resolveFxGesturePlayback(event, { ...params, filterCutoff: params.filterCutoff * filterScale })
      fx.volume.value = Tone.gainToDb(s.layers.fx.volume * event.velocity * 0.48 * params.volumeScale * gesture.gainScale * gateScale)
      fxFilter.frequency.setValueAtTime(gesture.filterStart, time)
      if (gesture.rampSeconds > 0) fxFilter.frequency.exponentialRampToValueAtTime(gesture.filterEnd, time + gesture.rampSeconds)
      fx.triggerAttackRelease(gesture.length, time)
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
    currentRuntimeParams = resolveRuntimeParams(state)
    const bassParams = currentRuntimeParams.bass
    const padParams = currentRuntimeParams.pad
    const leadParams = currentRuntimeParams.lead
    const textureParams = currentRuntimeParams.texture
    const fxParams = currentRuntimeParams.fx
    const snareParams = currentRuntimeParams.snare
    bass.set({
      filter: { Q: bassParams.resonance },
      filterEnvelope: { baseFrequency: bassParams.filterCutoff },
    })
    subBass.set({
      filterEnvelope: { baseFrequency: Math.max(32, bassParams.filterCutoff * 0.18) },
    })
    pad.set({ envelope: { attack: padParams.attack, release: padParams.release } })
    padFilter.frequency.rampTo(padParams.filterCutoff, 0.04)
    lead.set({ envelope: { attack: leadParams.attack, release: leadParams.release } })
    leadFilter.frequency.rampTo(leadParams.filterCutoff, 0.04)
    leadReverb.wet.rampTo(leadParams.reverbWet, 0.04)
    leadDelay.wet.rampTo(leadParams.delayWet, 0.04)
    texture.set({ envelope: { attack: textureParams.attack, release: textureParams.release } })
    textureFilter.frequency.rampTo(textureParams.filterCutoff, 0.04)
    textureReverb.wet.rampTo(textureParams.reverbWet, 0.04)
    fx.set({ envelope: { attack: fxParams.attack, release: fxParams.release } })
    fxFilter.frequency.rampTo(Math.max(600, fxParams.filterCutoff * 0.3), 0.04)
    fxReverb.wet.rampTo(fxParams.reverbWet, 0.04)
    fxDelay.wet.rampTo(fxParams.delayWet, 0.04)
    snareReverbSend.gain.rampTo(snareParams.reverbWet * 0.42, 0.04)
    reverb.wet.rampTo(padParams.reverbWet, 0.04)
    Tone.Transport.bpm.rampTo(state.bpm, 0.08)
    Tone.Transport.swing = state.pattern.layers.drums.swing
    Tone.Transport.swingSubdivision = '16n'
  }

  function barToTransportTime(applyAtBar: number): string {
    return `${Math.max(0, Math.trunc(applyAtBar) - 1)}:0:0`
  }

  function barToPreBoundaryTransportTime(applyAtBar: number): string {
    const toneBar = Math.max(0, Math.trunc(applyAtBar) - 1)
    if (toneBar === 0) return '0:0:0'
    // Tone.Transport callbacks scheduled exactly on the same downbeat as the
    // 16n playback loop can run after the loop callback. Apply state a tiny
    // musical tick before the target bar so the first downbeat hears it.
    return `${toneBar - 1}:3:3.75`
  }

  const loops = [
    new Tone.Loop((time) => {
      const s = currentState
      if (!s) return
      for (const event of resolvePlaybackStepEvents(s, step)) {
        playPatternEvent(event, time)
      }
      step = (step + 1) % s.pattern.layers.drums.steps
    }, '16n'),
  ]

  function unlockAudio() {
    return Tone.start()
      .then(() => Tone.getContext().resume())
      .then(() => {
        restoreMasterGain()
      })
  }

  function applyListeningDucking(ducked: boolean) {
    listeningDucked = ducked
    // Push-to-talk should make room for the user's voice immediately, but the
    // release can be a little slower so the music comes back smoothly.
    master.gain.rampTo(ducked ? 0.01 : 0.72, ducked ? 0.02 : 0.22)
  }

  function restoreMasterGain() {
    master.gain.cancelScheduledValues(Tone.now())
    master.gain.value = listeningDucked ? 0.01 : 0.72
  }

  function releaseVoicesNaturally() {
    const now = Tone.now()
    kickFallback.triggerRelease(now)
    snareFallback.triggerRelease(now)
    hatFallback.triggerRelease(now)
    bass.triggerRelease(now)
    subBass.triggerRelease(now)
    pad.releaseAll(now)
    lead.releaseAll(now)
    texture.triggerRelease(now)
    fx.triggerRelease(now)
  }

  function gracefulSilence() {
    const now = Tone.now()
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(master.gain.value, now)
    releaseVoicesNaturally()
    // STOP should feel like taking hands off the instrument, not an emergency
    // power cut. Leave short tails/reverb audible for a moment, then silence.
    master.gain.linearRampToValueAtTime(0, now + 0.65)
  }

  function hardSilence() {
    const now = Tone.now()
    master.gain.cancelScheduledValues(now)
    // PANIC must mute before releasing/stopping voices so envelopes, samples,
    // reverb, and compressor tails cannot leak through.
    master.gain.setValueAtTime(0, now)
    kick.stop(now)
    snare.stop(now)
    hats.stop(now)
    releaseVoicesNaturally()
  }

  return {
    async start() {
      await unlockAudio()
      void Tone.loaded()
      restoreMasterGain()
      step = 0
      Tone.Transport.cancel()
      Tone.Transport.position = '0:0:0'
      Tone.Transport.bpm.value = currentState?.bpm ?? 124
      loops.forEach((loop) => loop.start(0))
      Tone.Transport.start()
    },
    async resume() {
      await unlockAudio()
      void Tone.loaded()
      restoreMasterGain()
      loops.forEach((loop) => loop.start(0))
      Tone.Transport.start()
    },
    pause() {
      Tone.Transport.pause()
    },
    stop() {
      Tone.Transport.stop()
      Tone.Transport.cancel()
      Tone.Transport.position = '0:0:0'
      loops.forEach((loop) => loop.stop())
      step = 0
      gracefulSilence()
    },
    panic() {
      hardSilence()
      Tone.Transport.stop()
      Tone.Transport.cancel()
      Tone.Transport.position = '0:0:0'
      loops.forEach((loop) => loop.stop())
      step = 0
    },
    update(state: LoopState) {
      applyStateAtAudioBoundary(state)
    },
    setListeningDucking(ducked: boolean) {
      applyListeningDucking(ducked)
    },
    scheduleUpdateAtBar(state: LoopState, applyAtBar: number, onApplied?: () => void) {
      const transportTime = barToTransportTime(applyAtBar)
      const engineApplyTime = barToPreBoundaryTransportTime(applyAtBar)
      const id = Tone.Transport.scheduleOnce(() => {
        applyStateAtAudioBoundary(state)
        onApplied?.()
      }, engineApplyTime)
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
        listeningDucked,
      }
    },
    getTransportPosition() {
      return getTransportPosition()
    },
    async unlockAudio() {
      await unlockAudio()
    },
    async preview() {
      await unlockAudio()
      const startAt = Tone.now() + 0.04
      const beatSeconds = 60 / (currentState?.bpm ?? 124)
      for (let beat = 0; beat < 4; beat += 1) {
        playKick(startAt + beat * beatSeconds, 0.86)
      }
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
        bass,
        subBass,
        pad,
        padFilter,
        lead,
        leadFilter,
        leadReverb,
        leadDelay,
        texture,
        textureFilter,
        textureReverb,
        fx,
        fxFilter,
        fxReverb,
        fxDelay,
        reverb,
        snareReverbSend,
        snareReverb,
        drumBus,
        master,
        analyser,
      ].forEach((node) => node.dispose())
    },
  }
}
