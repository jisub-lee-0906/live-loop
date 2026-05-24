---
id: parameter-ramping-and-graph-safety
title: Tone.js parameter ramping and graph safety
tags: [ramp, filter, gain, envelope, graph, safety]
source: frontend/node_modules/tone/Tone/source/oscillator/OscillatorInterface.ts, frontend/node_modules/tone/Tone/instrument/MembraneSynth.ts, frontend/src/audioEngine.ts
verified_with: tone@15.1.22
---

# Tone.js parameter ramping and graph safety

Tone exposes signal-style parameters that support scheduled changes such as `setValueAtTime`, `exponentialRampToValueAtTime`, and `rampTo` depending on the node/param type. Tone source examples use callback `time` for precise scheduled parameter changes.

Live-loop rules:
- Resolve LLM/generated macros into clamped runtime params before the audio boundary.
- Use ramps for filter/gain/wet changes to avoid clicks.
- Keep graph construction stable; avoid node creation/disposal in per-step callbacks.
- Keep `master.toDestination(); master.connect(analyser)` style split so visualizer does not become required pass-through output.
- For React/Vite dev, avoid disposing the Tone graph during Fast Refresh remounts.

Good DSL macro targets:
- `filterCutoff` (Korean: 필터, 컷오프, 어둡게, 밝게, 열어줘)
- `resonance`
- `attack`
- `release`
- `reverbWet`
- `delayWet`
- `drive`
- `volume`

Validation guidance:
- Filter cutoff must be positive and inside target instrument range.
- Exponential ramps must never ramp to or from zero.
- Wet values stay 0..1.
- Envelope values stay in conservative bounds for live use.
- If a macro is not actually wired to Tone.js, mark it unsupported rather than exposing it to LLM.

Planner guidance:
- For vague words like “공간감”, prefer reverb/delay/pad/texture changes.
- For “어둡게”, lower filter cutoff and preserve rhythm/bass unless explicitly asked.
- For “더 몰아”, increase density/velocity or add hats/lead/fx; do not blindly raise all volumes.
