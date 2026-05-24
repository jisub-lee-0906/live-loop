---
id: safe-transport-scheduling
title: Tone.js Transport safe scheduling
tags: [transport, scheduling, loop, boundary, safety]
source: frontend/node_modules/tone/Tone/core/clock/Transport.ts, frontend/node_modules/tone/Tone/event/Loop.ts
verified_with: tone@15.1.22
---

# Tone.js Transport safe scheduling

Tone.Transport is for musical timing. In Tone 15.1.22 source, Transport callbacks receive the exact scheduled audio time; triggered synth/player calls should use that callback `time` instead of `Tone.now()`.

Useful docs/source facts:
- `Transport.scheduleRepeat((time) => ..., '8n')` passes exact scheduled time to the callback.
- `Tone.Loop` creates looped callbacks on the Transport timeline and can be started/stopped/cancelled with TransportTime.
- The live-loop app uses a 16n playback loop. If a state apply callback and playback callback are scheduled on the same downbeat, callback ordering can make the first beat hear stale state. Prefer pre-boundary state apply, then let the visible/user timing remain “next bar/phrase”.

Live-loop rules:
- STT/LLM latency must never block Transport callbacks.
- LLM plans should output musical timing (`next_bar`, `next_phrase`, `now` only for emergency/panic), not imperative JS scheduling code.
- Apply graph/parameter changes at safe boundaries; per-step callbacks should mostly trigger notes/events using already-resolved runtime params.

Allowed planner DSL ideas:
- `timing: "next_bar"` for simple layer additions.
- `timing: "next_phrase"` for transitions, drops, arrangement-wide changes.
- `events[].step` for PatternDSL events.
- `preserve` list for layers that should not be muted or overwritten.

Avoid:
- Arbitrary `setTimeout`/browser-clock scheduling for musical events.
- Creating/disposing synths inside 16n callbacks.
- Large LLM/model work inside Transport callbacks.
