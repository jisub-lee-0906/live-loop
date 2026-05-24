# Tone.js Live-safe Decision Table

이 표는 `live-loop`에서 Tone.js 기능을 LLM/patch layer에 노출할지 결정하는 기준이다.
초안이며 spike 결과에 따라 업데이트한다.

| Category | Tone.js objects/params | Live policy | Timing | Expose to LLM? | Current status |
|---|---|---|---|---|---|
| Panic / emergency stop | `Transport.stop/cancel`, voice release, schedule cancel | stop transport, cancel schedules, release voices, reset position; do not auto-restart master/transport | immediate | No; command only | manual QA found ramp-only panic felt like stop-then-start; patched |
| Step playback | `Tone.Loop('16n')` | PatternDSL event trigger only | audio callback | No direct | used |
| Scheduled state update | `Transport.scheduleOnce`, `clear` | scheduler-owned; engine apply must happen a tiny musical tick before target downbeat so first beat hears new state | pre-boundary for next_bar/next_phrase; UI still shows target bar | Indirect via timing enum | validated by manual QA; production patched |
| Layer gain | `Gain.gain`, player/synth volume | ramp or per-event volume | now or next_bar | Yes as `volume` | used |
| BPM | `Transport.bpm.rampTo` | cautious ramp | next_phrase | Yes within 60-180 | used |
| Swing | `Transport.swing`, `swingSubdivision` | only if audible timing verified | next_bar | Conditional | needs audit |
| Player one-shot drums | `Tone.Player` | trigger only, no live sample swap yet | step event | No sample path exposure | used |
| Drum fallback synths | `MembraneSynth`, `NoiseSynth`, `MetalSynth` | stable graph, param macro only | next_bar | Limited macros | used |
| Bass synth | `MonoSynth` | macro params only | next_bar for tone, step for notes | Yes via registry | partially used |
| Sub bass | separate `MonoSynth` | separate voice, never fake same synth sub | step event | preset/macro only | used |
| Pad synth | `PolySynth(Synth)` | macro params only | next_bar | Yes via registry | partially used |
| Filter cutoff/Q | `Filter.frequency`, synth filter/Q | ramp safe | now/next_bar depending target | Yes, clamped | partially used |
| Reverb wet/send | `Reverb.wet`, send gain | ramp safe | next_bar | Yes, clamped | partially used |
| Delay/feedback | `FeedbackDelay`, `PingPongDelay` | feedback capped; not MVP until spike | next_bar | Later only | unsupported |
| Chorus/width | `Chorus`, `StereoWidener` | stable node pre-created if used | next_bar | Later via pad width | unsupported |
| Distortion/drive | `Distortion`, gain staging | cap amount; limiter if needed | next_bar | Later via drive | partial macro only |
| AutoFilter/LFO | `AutoFilter`, `LFO` | start/stop at boundaries | next_phrase | Later automation | unsupported |
| Node create/dispose | any node graph mutation | avoid while playing; pre-create or rebuild at safe stop | stop or next section | No | forbidden in live callback |
| Arbitrary JS | generated Tone.js code | never in live path | never | No | forbidden |
| Analyzer/Meter | `Analyser`, `Meter` | read-only visual signal | animation frame | No | used/analyser only |

## Immediate decisions

1. MVP keeps project-owned PatternDSL + one Tone.Loop until spike 002 proves Part/Sequence is better.
2. LLM never receives raw Tone.js object names as executable targets.
3. New Tone.js capability enters in this order: registry -> test -> runtime params -> audio engine -> audible verification.
4. Unsupported but tempting params stay visible in docs only, not in LLM capability list.
