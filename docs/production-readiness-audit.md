# Production Readiness Audit

Date: 2026-05-24
Scope: current `main` implementation checked against `docs/architecture-spine.md` and the finished-product roadmap.

## Summary

The project is now an MVP candidate, not yet a finished product.

Strong areas:
- The main product identity is documented and consistent: voice-controlled local AI live loop instrument.
- The frontend has a single MusicPatch/PatternDSL-centered state path for most deterministic, backend, and ArrangementPlan changes.
- Empty transport, pending scheduling, PTT-first UX, visualizer truth gating, undo, stop, panic, and plan preview are present in code.
- Tone.js runtime params exist for kick, snare, hats, bass, pad, lead, texture, and fx.
- Generated FX PatternDSL/automation has a frontend bridge and runtime path.

Remaining productization risk:
- The product still needs a locked golden hands-on QA flow and one-entrypoint runtime/launcher.
- Some legacy and fallback paths still exist and should be audited before more feature expansion.
- Manual audible QA is still required for timing feel, clicks, mix quality, and STT behavior after music starts.

## Architecture spine compliance

### 1. Start from silence / empty transport

Status: mostly satisfied.

Evidence:
- `frontend/src/loopState.ts` initializes all layers with `enabled: false`.
- `frontend/src/App.tsx` uses `startEmptyLoop()` to update the engine with current state and show `EMPTY LOOP`.
- `frontend/src/App.tsx` computes `visualizerActive = isPlaying && hasAudibleLayers`.

Manual QA still required:
- Fresh browser load should produce no audible layer until the first command.
- Visualizer should remain idle/static when transport runs with no audible layers.

### 2. Single reducer/scheduler path

Status: mostly satisfied, with one legacy path to watch.

Evidence:
- `frontend/src/loopState.ts` routes deterministic catalog commands through `selectDeterministicPatches()` -> `applyMusicPatches()`.
- `frontend/src/apiClient.ts` converts backend command actions into `MusicPatch` data via `applyBackendCommandAction()`.
- `frontend/src/apiClient.ts` converts `/api/llm/arrange` ArrangementPlan output into frontend patches via `musicPatchesFromArrangementPlan()` and `applyMusicPatches()`.
- `frontend/src/App.tsx` schedules resulting planned state using `pendingPatch.timing` converted by `timingToQuantization()`.

Watch item:
- `frontend/src/loopState.ts::patchPattern()` is a legacy live-code/pattern shortcut triggered by broad words like `하우스`, `garage`, `그루브`. It mutates pattern/layers directly rather than going through MusicPatch. This may be acceptable as a dev shortcut, but for finished product it should either be converted to MusicPatch/ArrangementPlan or hidden behind debug mode.

### 3. Validated MusicPatch / PatternDSL / ArrangementPlan data

Status: satisfied for the current implemented path.

Evidence:
- `frontend/src/musicPatch.ts` rejects unsupported patches with `isPatchSupported()` before state mutation.
- `frontend/src/arrangementPlan.ts` is the bridge from ArrangementPlan to MusicPatch.
- `frontend/src/patternDsl.ts` and `frontend/src/playbackEvents.ts` provide data-first pattern/event flow.
- `frontend/src/musicPatch.ts` preserves generated FX pattern events and automation via `set_pattern_events` and `set_automation` for `fx`.

Watch item:
- Pattern data application currently only supports `fx` in `applyPatternData()`. That is safe, but future PatternDSL expansion for drums/bass/pad must explicitly add validation and audible runtime support before exposing it.

### 4. Pending state and quantized scheduler

Status: satisfied in design; needs hands-on timing QA.

Evidence:
- `frontend/src/App.tsx` plans from `plannedStateRef.current` so queued commands stack against the intended future state.
- `frontend/src/App.tsx` schedules with `engine.scheduleUpdateAtBar(result.state, decision.applyAtBar, ...)`.
- `frontend/src/audioEngine.ts` applies state slightly before the target bar via `barToPreBoundaryTransportTime()` to avoid same-downbeat callback ordering issues.
- UI describes relative timing with `formatBarsUntilApply()` / `describeSchedule()` instead of raw absolute Tone.Transport bars.

Manual QA still required:
- First kick should enter exactly at the next bar from an empty running transport.
- FX next-phrase transitions should not land a bar late or early.
- Queued state preview should match what is eventually heard.

### 5. Audio runtime params and audible wiring

Status: broadly satisfied.

Evidence:
- `frontend/src/audioRuntimeParams.ts` resolves runtime params for every role: kick, snare, hats, bass, pad, lead, texture, fx.
- `frontend/src/audioEngine.ts` uses those params in playback or boundary updates: bass filter/sub, pad filter/reverb/envelope, lead filter/reverb/delay, texture filter/reverb, fx filter/reverb/delay, snare reverb send, hats brightness/release, kick drive/scale.
- `frontend/src/playbackEvents.ts` is used from the 16th-note Tone.Loop.

Manual QA still required:
- Confirm macros are not just technically wired but musically useful.
- Check clicks/pops when params change at boundaries.
- Check whether generated FX automation sounds like a deliberate transition rather than noise.

### 6. PTT/STT live safety

Status: partially satisfied; must be tested in the real browser/mic path.

Evidence:
- `frontend/src/App.tsx` unlocks audio inside the trusted PTT pointer/key gesture.
- `frontend/src/App.tsx` blocks new listening while `isTranscribing` is true.
- `frontend/src/App.tsx` uses `sttRequestIdRef` to ignore stale STT results.
- `frontend/src/sttGate.ts` is called before transcription to reject too-short/too-quiet recordings.
- `frontend/src/App.tsx` calls `engine.setListeningDucking(isListening)`, and `audioEngine.ts` ducks master gain while listening.

Manual QA still required:
- After kick/hats/bass are audible, repeated PTT should still recognize short Korean commands.
- Ducking should be strong enough to prevent loop bleed but not feel jarring.
- Empty transcript, hallucinated non-command text, mic failure, and API timeout should be clearly distinguishable in UI.

### 7. Stop / panic / undo

Status: mostly satisfied.

Evidence:
- `frontend/src/loopState.ts` implements undo history and clears pendingPatch on undo.
- `frontend/src/App.tsx` cancels pending schedules on immediate stop/panic path.
- `frontend/src/audioEngine.ts` separates graceful STOP (`gracefulSilence()`) from hard PANIC (`hardSilence()`).
- Performer hotkey surface remains minimal: `S` stop, `V` PTT, no extra direct `P` panic key.

Manual QA still required:
- STOP should be reliable after queued but unapplied changes.
- After STOP, the next start/command should re-arm master gain and not appear silent.

### 8. Visualizer truth

Status: satisfied in code; needs visual QA.

Evidence:
- `frontend/src/App.tsx` uses enabled audible layers to compute `visualizerActive`.
- The visualizer receives `active={visualizerActive}`.

Manual QA still required:
- Empty transport should remain visually idle.
- SOUND CHECK should not imply a layer was added.
- Visual motion should correspond to sustained audible layers, not just transport time.

## Productization gaps before finished-product status

### Gap A — Golden flow is not yet a formal QA artifact

Create a repo-level manual QA checklist based on `docs/finished-product-roadmap.md` with expected UI messages, expected audible result, and pass/fail notes.

Suggested file:
- `docs/qa/golden-performance-flow.md`

### Gap B — One-entrypoint runtime is missing

The project still requires developer commands for backend/frontend. A finished product needs a launcher or managed sidecar path.

Near-term target:
- `scripts/start-dev-runtime.py` or equivalent one-command launcher.
- Checks ports 8101 and 5173.
- Starts backend and frontend.
- Polls `/api/health`, `/api/stt/status`, `/api/model/status`, and frontend `/`.
- Prints exact local URL and readiness.

### Gap C — Legacy pattern shortcut should be resolved

`patchPattern()` in `loopState.ts` should be classified:

Option 1: keep as development-only text/debug shortcut.
Option 2: convert into explicit MusicPatch/PatternDSL operations.
Option 3: remove if it conflicts with the acceptance flow.

Do not expand it as a parallel product path.

### Gap D — Backend target coverage should be checked for expanded roles

`apiClient.ts::isLayerId()` currently recognizes `kick`, `snare`, `hats`, `bass`, `pad`, `lead`. If backend fast commands or LLM intent responses can target `texture` or `fx`, the frontend backend-action bridge should be extended or should deliberately reject those targets with a visible fallback.

### Gap E — Manual audible QA is still the true release gate

Automated tests can prove state shape and build health, but cannot prove:
- first-command audibility,
- groove feel,
- click-free ramps,
- visualizer/audio alignment,
- PTT usability after speakers are playing,
- musical usefulness of generated FX.

## Recommended next implementation tasks

1. Add `docs/qa/golden-performance-flow.md`.
2. Add a one-command dev runtime launcher with health checks.
3. Decide the fate of `patchPattern()`.
4. Verify/extend backend-action target coverage for `texture` and `fx` if those are expected through backend fast path.
5. Run the golden flow with the real browser/mic path and log failures as product bugs, not as feature ideas.

## Current status label

Use this label for planning:

`MVP candidate / productization entry`

Do not call the project production-ready until the launcher, golden manual QA, repeated PTT hardening, and packaging/release path pass.
