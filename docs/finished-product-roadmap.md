# live-loop Finished Product Roadmap

This document defines the product identity and the remaining gates from the current MVP-candidate state to a finished local performance instrument.

## Product identity

`live-loop` is a voice-controlled local AI live loop instrument.

The performer conducts by voice. The system listens through push-to-talk STT, interprets Korean/English musical language with deterministic rules and/or a local LLM, converts the result into validated MusicPatch / PatternDSL / ArrangementPlan data, and applies it through Tone.js at safe musical boundaries.

## Identity in one sentence

A local AI performance instrument where the user stays the conductor, the LLM translates intent into verified musical data, and the audio engine performs that data safely in time.

## What this product is

- A voice-first loopstation that starts from silence.
- A local-first performance tool, not an internet-dependent song service.
- A timing-safe musical state machine: text/STT -> intent -> verified patch/plan -> LoopState -> scheduler -> Tone.js.
- A small AI ensemble whose roles, patterns, macros, and transition gestures are constrained but composable.
- An instrument where failure must be visible, recoverable, and non-destructive.

## What this product is not

- Not a full-song generator like Suno.
- Not an Ableton replacement DAW.
- Not a generic chatbot that happens to make sound.
- Not a toy preset selector where every phrase maps to one hardcoded loop.
- Not an arbitrary live JavaScript/Tone.js code executor.
- Not a dashboard-first developer tool as the primary performance surface.

## Finished-product promise

A user should be able to double-click the app, pass sound/mic/model readiness checks, and perform a five-minute voice-led loop without touching a terminal.

Minimum finished experience:

1. App opens with no Linux-bridge/npm/uv/manual port work.
2. Splash/readiness screen shows audio, mic, backend, STT, and local model state.
3. Main performance surface starts as `EMPTY LOOP`.
4. `SOUND CHECK` proves audio unlock/output routing with a short musical four-kick check.
5. `PUSH TO TALK` captures short Korean commands reliably.
6. Commands schedule at next bar/phrase unless they are explicit STOP/PANIC.
7. The visualizer stays idle when there are no audible layers and reacts only when sound exists.
8. STOP reliably returns the instrument to a safe playable state.
9. Failures explain what failed and how to retry.

## Golden five-minute performance flow

This is the core acceptance script. New features should not distract from making this flow reliable and musical.

1. Fresh app launch -> `READY`.
2. Press `SOUND CHECK` -> four kicks are audible, no layer is added.
3. Start empty transport -> `EMPTY LOOP`, visualizer idle/static.
4. Say “킥 깔아줘” -> kick enters next bar.
5. Say “하이햇 얹어줘. 살짝 셔플.” -> hats enter, groove stays stable.
6. Say “어두운 베이스 넣어줘” -> bass enters with dark/round tone.
7. Say “리드 하나 반짝이게” -> sparse lead enters without masking the groove.
8. Say “공간감만 좀 줘” -> texture/pad/space increases without replacing the groove.
9. Say “드랍 전에 숨 한번 참는 느낌으로 잘라줘” -> generated FX/automation transition queues to phrase boundary.
10. Say “베이스 잠깐 빼” -> bass mutes while preserving sound settings.
11. Say “다시 드랍” -> bass returns and energy rises.
12. Say “되돌려” -> prior musical state returns.
13. Press `S` or say “멈춰” -> transport stops safely and can restart.

## Production readiness gates

### Gate 1 — MVP lock

Goal: current browser app behaves like a coherent instrument before more capability expansion.

Required:
- Golden five-minute flow passes by text input.
- Golden five-minute flow passes by PTT/STT after STT warmup.
- No audible layer at fresh start.
- First voice command is audible from a fresh page.
- Pending updates preview the planned state, not only already-applied state.
- Undo, mute, drop, and stop are reliable.
- Visualizer truth: idle when silent, reactive when audible.

Exit criterion:
- A user can perform for five minutes locally with no code changes and report only subjective sound/feel issues, not broken control flow.

### Gate 2 — Product shell

Goal: replace developer process management with a user-facing runtime.

Required:
- One command or launcher starts backend and frontend.
- Health checks cover `/api/health`, `/api/stt/status`, `/api/model/status`, and frontend readiness.
- Startup reports port conflicts and stale processes clearly.
- STT and LLM prewarm are explicit and visible.
- Environment template documents model paths and optional API fallback.
- App can open in deterministic text/demo mode even if local models are missing.

Exit criterion:
- The user can start the app from one entrypoint and immediately test from a browser/window without remembering uv/npm commands.

### Gate 3 — Performance hardening

Goal: repeated live use does not corrupt state, timing, or STT.

Required:
- PTT ducking is active while listening.
- Too-short/too-quiet recordings are gated before STT.
- Stale STT/LLM responses cannot overwrite newer commands.
- Backend timeout, unsupported command, empty transcript, and mic failure are distinct user messages.
- Transport can run 20–30 minutes without scheduling drift visible to the user.
- STOP and PANIC semantics remain internally distinct, while performer controls stay minimal.

Exit criterion:
- Repeated PTT commands after music starts remain usable and do not apply stale or hallucinated text.

### Gate 4 — Sound identity pass

Goal: the instrument has a recognizable musical character instead of a generic demo sound.

Recommended initial identity:
- Dark, minimal, local electronic loop instrument.
- UKG / dub / ambient / leftfield club influence.
- Sparse layers, strong low-end, airy hats, subtle texture, phrase-safe FX.

Initial palette:
- kick: tight, deep, muted.
- snare/clap: dry, short, ghost-capable.
- hats: airy, shuffled, metallic but controlled.
- bass: dark sub, rubber pluck, restrained drive.
- pad: wide minor, filtered, not too loud.
- lead: sparse sparkle arp / bell pluck.
- texture: vinyl air / noise bed / room tone.
- fx: riser sweep, stutter gate, delay throw, drop impact.

Exit criterion:
- The first 30 seconds sound like this product, not just “Tone.js default instruments”.

### Gate 5 — Release packaging

Goal: another person can install and run the MVP without developer assistance.

Required:
- Tauri/Electron decision recorded.
- Backend sidecar strategy defined.
- Model downloader or separate offline model pack defined.
- Samples/presets/schemas bundled outside git model binaries.
- Fresh-machine smoke test script exists.
- README contains first-run, troubleshooting, and known-issues sections.
- Version tag and release artifact exist.

Exit criterion:
- A fresh Windows user can launch the app, pass readiness checks, and run the golden performance flow.

## Feature growth rule

Do not add broad new musical capabilities until the current acceptance flow is stable.

When adding capabilities, use this path only:

```text
role/capability idea
  -> Tone.js docs/source check when audio behavior changes
  -> schema/registry update
  -> validator support
  -> reducer tests
  -> runtime params mapping
  -> Tone.js audio wiring
  -> UI/debug preview
  -> automated tests
  -> manual audible QA
```

A capability is not supported until it is audible end-to-end.

## Current strategic priority

The next work should prioritize productization over feature expansion:

1. Run an implementation audit against `docs/architecture-spine.md`.
2. Lock the golden five-minute flow as the canonical QA script.
3. Create a one-entrypoint dev launcher with health checks.
4. Add/verify startup readiness and failure messages.
5. Perform hands-on auditory QA for timing, clicks, groove, and visualizer truth.
