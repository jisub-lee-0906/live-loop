---
id: noise-fx-gestures
title: NoiseSynth transition FX gestures
tags: [noise, fx, riser, impact, stutter, delay, filter, reverb]
source: frontend/node_modules/tone/Tone/instrument/NoiseSynth.ts, frontend/src/audioEngine.ts
verified_with: tone@15.1.22
---

# NoiseSynth transition FX gestures

Tone.NoiseSynth is a Noise source through an AmplitudeEnvelope. In Tone 15.1.22 source, `NoiseSynth.triggerAttackRelease(duration, time)` takes duration and time; it does not use a musical note.

Live-loop can use NoiseSynth + filter + reverb/delay for transition gestures:

## Riser sweep
- Korean command words/synonyms: 라이저, 들어올려, 올려줘, 빌드업, 긴장감, 터질 것처럼.
- White noise into highpass/bandpass-like filter.
- Start lower filter frequency and ramp upward into the transition.
- Good for “들어올려”, “긴장감”, “빌드업”, “터질 것처럼”.
- Use phrase/bar boundary; often late phrase steps like 12-15 or final step 15.

DSL hints:
```json
{
  "target": "fx",
  "preset": "riser_sweep",
  "macros": { "filterCutoff": 9000, "reverbWet": 0.5, "delayWet": 0.22, "release": 1.2 },
  "events": [{ "step": 15, "voice": "fx", "gesture": "peak_sweep", "velocity": 0.45 }]
}
```

## Drop impact
- Short/fast attack with longer release/tail.
- Filter can start fuller/lower than a riser and decay down.
- Good for “드랍”, “쾅”, “터뜨려”, “무게감 있게”.
- Usually on step 0 of the new bar/phrase.

## Delay throw
- Korean command words/synonyms: 딜레이, 던져, 넘겨, 남겨, 꼬리, 메아리.
- Short FX/noise or captured tail with high delay wet.
- Good for “마지막 소리 남겨”, “넘겨”, “던져”, “공간으로 보내”.
- Usually last 1-2 steps before the next section.

## Stutter gate
- Several very short gated events near the end of a phrase.
- Good for “끊어”, “잘라”, “숨 참는 느낌”, “게이트”.
- Keep release short to avoid smear.

Safety:
- Planner may choose gesture/preset/macros/events, but runtime must validate ranges.
- Do not let planner emit arbitrary Tone.js code.
- Do not instantiate new FX nodes during the live callback; use existing graph and parameter ramps.
