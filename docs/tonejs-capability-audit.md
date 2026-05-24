# Tone.js Capability Audit for live-loop

This document records what Tone.js can safely do for `live-loop` and how that should shape the verified MusicPatch/PatternDSL design.

## Installed version

Current project package:

- `tone@15.1.22`

Tone.js is a Web Audio framework. It provides synths, samplers/players, effects, transport scheduling, analysis nodes, and audio graph utilities. It is not a standalone music DSL; the DSL must be designed by this project and interpreted into Tone.js operations.

## Current project audio engine

Current file:

- `frontend/src/audioEngine.ts`

Current graph summary:

```text
kick Player / MembraneSynth fallback
snare Player / NoiseSynth fallback
hats Player / MetalSynth fallback
  -> drumBus Compressor
  -> master Gain
  -> destination + analyser

bass MonoSynth
  -> master Gain

pad PolySynth
  -> Reverb
  -> master Gain

preview Synth
  -> master Gain
```

Transport:

- `Tone.Transport`
- one `Tone.Loop` running every `16n`
- pattern events resolved from project `LiveCodePattern`
- state updates can be scheduled with `Tone.Transport.scheduleOnce`

Visualizer:

- `Tone.Analyser` connected from master branch

## Tone.js classes relevant to this project

### Instruments / sound sources

Useful for current and future layers:

- `Tone.Player` / `Tone.Players`: one-shot or looped samples
- `Tone.Sampler`: pitched sample instruments
- `Tone.Synth`: basic oscillator + envelope
- `Tone.MonoSynth`: oscillator + filter + amplitude/filter envelopes
- `Tone.PolySynth`: polyphonic wrapper for synth voices
- `Tone.MembraneSynth`: kick/tom-like drums
- `Tone.NoiseSynth`: snare/noise percussion
- `Tone.MetalSynth`: metallic hats/percussion
- `Tone.FMSynth`: FM tones/bells/basses
- `Tone.AMSynth`: AM tones
- `Tone.PluckSynth`: plucked string-like sounds
- `Tone.GrainPlayer`: granular sample playback

### Effects / processing

Useful for macro mapping:

- `Tone.Filter`
- `Tone.EQ3`
- `Tone.Compressor`
- `Tone.Limiter`
- `Tone.Reverb`
- `Tone.Freeverb`
- `Tone.FeedbackDelay`
- `Tone.PingPongDelay`
- `Tone.Chorus`
- `Tone.Phaser`
- `Tone.Distortion`
- `Tone.BitCrusher`
- `Tone.AutoFilter`
- `Tone.AutoPanner`
- `Tone.Tremolo`
- `Tone.Vibrato`
- `Tone.StereoWidener`
- `Tone.PitchShift`

### Scheduling / patterns

- `Tone.Transport`
- `Tone.Loop`
- `Tone.Sequence`
- `Tone.Part`
- `Tone.Pattern`
- `ToneEvent`

For `live-loop`, the safest pattern is project-owned PatternDSL + engine-owned `Tone.Loop`, rather than letting the LLM create Tone.js scheduling code directly.

### Analysis / visualizer

- `Tone.Analyser`
- `Tone.Meter`
- `Tone.Waveform`
- `Tone.FFT`

## Tone.js syntax basics

Import:

```ts
import * as Tone from 'tone'
```

Start audio after a trusted user gesture:

```ts
await Tone.start()
await Tone.getContext().resume()
```

Create synth:

```ts
const bass = new Tone.MonoSynth({
  oscillator: { type: 'fatsawtooth' },
  filter: { type: 'lowpass', Q: 2, rolloff: -24 },
  envelope: { attack: 0.006, decay: 0.22, sustain: 0.22, release: 0.14 },
  filterEnvelope: { baseFrequency: 58, octaves: 3.1, attack: 0.006, decay: 0.2, sustain: 0.12, release: 0.12 },
}).connect(master)
```

Play note:

```ts
bass.triggerAttackRelease('C2', '8n', time)
```

Play sample:

```ts
const kick = new Tone.Player('/samples/kick.wav').connect(drumBus)
kick.start(time)
```

Schedule loop:

```ts
new Tone.Loop((time) => {
  synth.triggerAttackRelease('C2', '8n', time)
}, '16n').start(0)

Tone.Transport.start()
```

Ramp values:

```ts
master.gain.rampTo(0.5, 0.1)
Tone.Transport.bpm.rampTo(130, 0.5)
filter.frequency.rampTo(900, 0.2)
```

## Safe live-change categories

These can generally be changed during playback, often with ramping:

- layer gain / volume
- master gain / ducking
- filter cutoff/frequency
- filter Q/resonance
- envelope attack/decay/sustain/release, within safe ranges
- reverb wet
- delay feedback/wet
- distortion amount, within safe range
- compressor/limiter parameters, cautiously
- note velocity
- pattern density, if applied at a musical boundary
- mute/unmute
- BPM ramp, cautiously

## Next-bar / phrase-boundary categories

These should usually be scheduled to `next_bar`, `next_2bar`, or `next_4bar`:

- instrument preset change
- oscillator type change
- sample preset change
- pattern replacement
- bassline rewrite
- chord/pad change
- major groove/style transition
- section changes such as build/drop/breakdown
- swing/density changes that affect perceived groove

## Dangerous or sandbox-only categories

Do not expose these to live LLM output directly:

- arbitrary JavaScript/Tone.js code execution
- unvalidated node creation/disposal mid-bar
- unbounded feedback delay/reverb/drive values
- unvalidated external sample loading
- large graph rewrites while audio is running
- infinite scheduling loops
- direct access to browser APIs beyond the engine adapter

If LLM-generated code is ever allowed, it should be dev/sandbox-only, converted to verified DSL or patch data before live use.

## Initial layer capability mapping

### Kick

Current nodes:

- sample: `Tone.Player`
- fallback: `Tone.MembraneSynth`

Candidate macros:

- `volume`
- `punch`
- `body`
- `click`
- `decay`
- `pitchDrop`

Likely Tone mappings:

- `volume` -> player/fallback gain
- `punch` -> transient gain/envelope attack emphasis
- `body` -> fallback pitch/body gain balance
- `click` -> sample/fallback high transient balance, future EQ
- `decay` -> fallback envelope decay/release
- `pitchDrop` -> MembraneSynth pitch envelope feel

### Snare

Current nodes:

- sample: `Tone.Player`
- fallback: `Tone.NoiseSynth`

Candidate macros:

- `volume`
- `snap`
- `noise`
- `tail`
- `brightness`
- `reverb`

Likely Tone mappings:

- `volume` -> player/fallback gain
- `snap` -> transient/short decay emphasis
- `noise` -> fallback noise level/decay
- `tail` -> release/fadeOut/reverb send
- `brightness` -> future EQ/filter
- `reverb` -> send amount or shared reverb wet

### Hats

Current nodes:

- sample: `Tone.Player`
- fallback: `Tone.MetalSynth`

Candidate macros:

- `volume`
- `brightness`
- `decay`
- `density`
- `swing`
- `humanize`
- `openness`

Likely Tone mappings:

- `volume` -> player/fallback gain
- `brightness` -> future EQ/filter, MetalSynth resonance/harmonicity cautiously
- `decay` -> fallback envelope decay / sample fadeOut
- `density` -> pattern events
- `swing` -> pattern timing offset or Transport swing policy
- `humanize` -> velocity/timing variation
- `openness` -> sample/preset selection or decay increase

### Bass

Current node:

- `Tone.MonoSynth`

Candidate macros:

- `volume`
- `warmth`
- `brightness`
- `cutoff`
- `resonance`
- `attack`
- `decay`
- `drive`
- `movement`

Likely Tone mappings:

- `volume` -> bass output gain/volume
- `warmth` -> lower brightness/cutoff, maybe mild drive
- `brightness` -> filter envelope base frequency / cutoff range
- `cutoff` -> filterEnvelope baseFrequency or explicit filter frequency behavior
- `resonance` -> `bass.filter.Q`
- `attack` -> `bass.envelope.attack`
- `decay` -> `bass.envelope.decay` / `filterEnvelope.decay`
- `drive` -> future distortion send/amount
- `movement` -> filter envelope octaves/LFO-ready behavior

### Pad

Current nodes:

- `Tone.PolySynth(Tone.Synth)`
- `Tone.Reverb`

Candidate macros:

- `volume`
- `width`
- `brightness`
- `warmth`
- `attack`
- `release`
- `reverb`
- `shimmer`

Likely Tone mappings:

- `volume` -> pad volume/gain
- `width` -> future StereoWidener/Chorus, currently can map partially to reverb amount
- `brightness` -> synth oscillator/filter/EQ-ready behavior
- `warmth` -> darker tone, slower attack, lower brightness
- `attack` -> pad envelope attack
- `release` -> pad envelope release
- `reverb` -> `reverb.wet`
- `shimmer` -> future pitch/reverb/chorus preset behavior

## Design consequence

The first verified database should not try to describe every possible Tone.js feature. It should describe only safe, musically audible macro controls for the current five layers:

- kick
- snare
- hats
- bass
- pad

The LLM should select or combine verified MusicPatch entries that use these macros. The engine adapter then maps macros to Tone.js values.

## Next implementation targets

1. `frontend/src/music/musicPatch.ts`
2. `frontend/src/music/instrumentCapabilities.ts`
3. `frontend/src/music/patchCatalog.ts`
4. `frontend/src/music/applyMusicPatch.ts`
5. `frontend/src/music/toneMacroMapping.ts`
6. update `frontend/src/loopState.ts`
7. update `frontend/src/audioEngine.ts`
