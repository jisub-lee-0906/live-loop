# Live Loop Productization Roadmap: MVP + Verified Patch/DSL Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task after the user approves execution.

**Goal:** Build `live-loop` into a voice-first local AI live loop instrument whose LLM interprets STT text into verified MusicPatch/PatternDSL changes, while the Tone.js engine safely applies them on musical boundaries.

**Architecture:** The product is an algorithmic live music engine controlled through a natural-language LLM bridge. The LLM does not execute arbitrary Tone.js/JavaScript and should not devolve into selecting from an ever-growing preset menu; it composes parameterized MusicPlan/PatternDSL changes from a capability catalog. Audio state remains deterministic, testable, and timing-safe.

**Tech Stack:** React/Vite/TypeScript frontend, Tone.js/Web Audio engine, Python FastAPI backend, faster-whisper STT, local GGUF LLM via llama-cpp-python, Vitest/Pytest/Ruff/ESLint.

---

## Product Definition

`live-loop` is a voice-controlled local AI live-coding loop instrument.

The user builds and mutates a live loop by speaking Korean/English musical directions. The system transcribes speech, interprets text with deterministic rules and/or a local LLM, converts intent into validated MusicPatch/PatternDSL changes, and applies them through Tone.js at safe bar/phrase boundaries.

### Product Principles

1. Start from silence/empty transport.
2. User remains the conductor; AI is the natural-language bridge.
3. LLM output must be verified data, not executable code.
4. Current groove preservation is as important as change.
5. Audio clock must never block on STT/LLM.
6. All changes default to quantized timing.
7. Panic/undo/safe mute are required before deeper autonomy.
8. The performance UI is visualizer-first; debug surfaces are overlays/dev mode.

### MVP Acceptance Demo

From a fresh page:

1. User starts empty transport.
2. Says “킥 깔아줘” → kick enters next bar.
3. Says “하이햇 얹어줘” → hats enter next bar.
4. Says “베이스 둥글게 넣어줘” → bass enters with warmer/darker tone.
5. Says “킥은 유지하고 드럼 더 몰아줘” → kick preserved, hats/snare density increases.
6. Says “패드 넓게 깔아줘” → pad enters wider/reverb-heavy.
7. Says “전체 좀 어둡게” → mix/available layers become darker.
8. Says “베이스 잠깐 빼” → bass mutes safely.
9. Says “다시 드랍” → bass returns and energy increases.
10. Says “멈춰” or panic → immediate safe mute/stop path works.

---

## Phase 0 — Baseline Verification and Documentation

### Task 0.1: Record current product definition

**Objective:** Preserve the agreed product definition so future code changes do not drift into toy loopstation or unsafe free-code generation.

**Files:**
- Create/Modify: `docs/product-definition.md`

**Steps:**
1. Write the product definition from this plan.
2. Include “LLM as semantic bridge, algorithmic engine as performer.”
3. Include explicit non-goals: arbitrary JS execution, always-on STT, full song generation, dashboard-first UI.
4. Verify by reading the file.

**Verification:**
```bash
cd /home/jisub-lee/workspace/live-loop
sed -n '1,220p' docs/product-definition.md
```

### Task 0.2: Add Tone.js capability audit document

**Objective:** Document what Tone.js can safely change live, what needs next-bar scheduling, and what should remain sandbox-only.

**Files:**
- Create: `docs/tonejs-capability-audit.md`
- Reference: `frontend/src/audioEngine.ts`

**Content sections:**
1. Installed Tone version: `15.1.22`.
2. Current engine nodes: kick/snare/hat Players + fallbacks, MonoSynth bass, PolySynth pad, Reverb, Compressor, Gain, Analyser.
3. Safe live parameters: gain, volume, filter frequency/Q, envelope values, reverb wet, delay feedback, velocity, density, mute/unmute.
4. Next-bar changes: instrument preset, pattern replacement, oscillator type, major groove changes.
5. Dangerous/sandbox-only: arbitrary JS, node graph rewrites mid-bar, unbounded effects, unvalidated sample loads.
6. Initial mapping targets for kick/snare/hats/bass/pad.

**Verification:**
```bash
cd /home/jisub-lee/workspace/live-loop
sed -n '1,260p' docs/tonejs-capability-audit.md
```

---

## Phase 1 — MusicPatch Foundation

### Task 1.1: Create MusicPatch schema

**Objective:** Define a typed, validated patch contract for all algorithmic and LLM-driven musical changes.

**Files:**
- Create: `frontend/src/music/musicPatch.ts`
- Create: `frontend/src/music/musicPatch.test.ts`

**Types to add:**
```ts
export type LayerId = 'kick' | 'snare' | 'hats' | 'bass' | 'pad'
export type PatchTiming = 'now' | 'next_bar' | 'next_2bar' | 'next_4bar'
export type PreserveKey =
  | 'instrument'
  | 'pattern'
  | 'volume'
  | 'kick_pattern'
  | 'kick_sound'
  | 'bass_pattern'
  | 'bass_sound'
  | 'groove'

export type MusicPatch =
  | {
      action: 'add_layer' | 'mute_layer' | 'unmute_layer'
      target: LayerId
      timing?: PatchTiming
      preserve?: PreserveKey[]
    }
  | {
      action: 'modify_layer'
      target: LayerId
      macroChanges: Record<string, number>
      timing?: PatchTiming
      preserve?: PreserveKey[]
    }
  | {
      action: 'set_instrument'
      target: LayerId
      preset: string
      timing?: PatchTiming
      preserve?: PreserveKey[]
    }
  | {
      action: 'modify_pattern'
      target: LayerId | 'drums'
      patternChanges: Record<string, number | string | boolean>
      timing?: PatchTiming
      preserve?: PreserveKey[]
    }
  | {
      action: 'set_mix'
      macroChanges: Record<string, number>
      timing?: PatchTiming
      preserve?: PreserveKey[]
    }
  | {
      action: 'panic'
      timing: 'now'
    }
```

**Tests:**
- Valid patch passes `normalizeMusicPatch()`.
- Unknown action rejects.
- Invalid target rejects.
- Delta values clamp to safe range.
- Panic always normalizes to `timing: 'now'`.

**Verification:**
```bash
cd /home/jisub-lee/workspace/live-loop/frontend
npm test -- --run src/music/musicPatch.test.ts
```

### Task 1.2: Create instrument capability catalog v0

**Objective:** Define what each current instrument can safely change.

**Files:**
- Create: `frontend/src/music/instrumentCapabilities.ts`
- Create: `frontend/src/music/instrumentCapabilities.test.ts`

**Capability v0:**
- Keep a minimal `preset` field only as a safety primitive/fallback, not as the creative interface.
- `kick`: safe macros `volume`, `punch`, `body`, `click`, `decay`, `pitchDrop`.
- `snare`: safe macros `volume`, `snap`, `noise`, `tail`, `brightness`, `reverb`.
- `hats`: safe macros `volume`, `brightness`, `decay`, `density`, `swing`, `humanize`, `openness`.
- `bass`: safe macros `volume`, `warmth`, `brightness`, `cutoff`, `resonance`, `attack`, `decay`, `drive`, `movement`.
- `pad`: safe macros `volume`, `width`, `brightness`, `warmth`, `attack`, `release`, `reverb`, `shimmer`.
- Planner output should combine these macros with PatternDSL events/automation instead of mapping each phrase to a named preset.

**Tests:**
- Every macro has min/max/default.
- Default values are inside min/max.
- Unknown macro lookup fails closed.

**Verification:**
```bash
cd /home/jisub-lee/workspace/live-loop/frontend
npm test -- --run src/music/instrumentCapabilities.test.ts
```

### Task 1.3: Extend LoopState with sound macros and presets

**Objective:** Store current instrument preset and macro values per layer so patches can mutate the current instrument, not only toggle layers.

**Files:**
- Modify: `frontend/src/loopState.ts`
- Modify: `frontend/src/loopState.test.ts`

**Changes:**
1. Add to `LoopLayer`:
```ts
instrumentPreset: string
macros: Record<string, number>
```
2. Initialize from `instrumentCapabilities` defaults.
3. Keep existing `enabled`, `volume`, `complexity`, `subdivision` for compatibility during transition.

**Tests:**
- Initial state has all layers disabled.
- Each layer has a valid preset.
- Each layer has macro defaults from catalog.

**Verification:**
```bash
cd /home/jisub-lee/workspace/live-loop/frontend
npm test -- --run src/loopState.test.ts
```

---

## Phase 2 — Patch Catalog and Reducer

### Task 2.1: Create patch catalog v0

**Objective:** Build the first verified patch vocabulary that LLM/rules can select from.

**Files:**
- Create: `frontend/src/music/patchCatalog.ts`
- Create: `frontend/src/music/patchCatalog.test.ts`

**Patch presets v0:**
- `add_kick`
- `add_snare`
- `add_hats`
- `add_bass`
- `add_pad`
- `mute_bass`
- `unmute_bass`
- `kick_punchier`
- `kick_deeper`
- `bass_warmer`
- `bass_bouncier`
- `hats_denser`
- `hats_softer`
- `pad_wider`
- `pad_darker`
- `drums_busier_preserve_kick`
- `drums_simpler`
- `mix_darker`
- `mix_brighter`
- `drop_energy`
- `panic`

**Tests:**
- Every catalog entry expands to one or more valid `MusicPatch` objects.
- Every patch id is unique.
- Preserve rules exist for `drums_busier_preserve_kick`.
- Panic entry expands to immediate panic patch.

**Verification:**
```bash
cd /home/jisub-lee/workspace/live-loop/frontend
npm test -- --run src/music/patchCatalog.test.ts
```

### Task 2.2: Implement applyMusicPatch reducer

**Objective:** Apply verified patches to LoopState with clamp/preserve behavior as a pure function.

**Files:**
- Create: `frontend/src/music/applyMusicPatch.ts`
- Create: `frontend/src/music/applyMusicPatch.test.ts`

**Behavior:**
1. `add_layer`: enables target, preserves existing macros/pattern.
2. `mute_layer`: disables target without deleting macros/preset.
3. `unmute_layer`: re-enables target.
4. `modify_layer`: applies macro deltas with catalog clamp.
5. `set_instrument`: changes preset only if allowed.
6. `modify_pattern`: updates pattern intent fields without violating preserve keys.
7. `set_mix`: applies global tone changes by mapping to available layer macros.
8. `panic`: disables all layers and clears pending-compatible state.

**Tests:**
- “bass_warmer” increases warmth and decreases brightness/cutoff.
- “kick_punchier” does not affect hats/bass/pad.
- “drums_busier_preserve_kick” does not alter kick events or kick macros.
- “mute_bass” preserves bass preset/macros.
- Unknown macro is ignored/rejected safely.

**Verification:**
```bash
cd /home/jisub-lee/workspace/live-loop/frontend
npm test -- --run src/music/applyMusicPatch.test.ts
```

### Task 2.3: Convert existing applyCommand to patch-based flow

**Objective:** Route deterministic commands through the same patch catalog/reducer that the LLM will use.

**Files:**
- Modify: `frontend/src/loopState.ts`
- Modify: `frontend/src/loopState.test.ts`
- Import: `patchCatalog`, `applyMusicPatch`

**Behavior examples:**
- “킥 깔아줘” → `add_kick`
- “하이햇 얹어줘” → `add_hats`
- “베이스 둥글게 넣어줘” → `add_bass` + `bass_warmer`
- “킥은 유지하고 드럼 더 몰아줘” → `drums_busier_preserve_kick`
- “패드 넓게” → `add_pad` + `pad_wider`
- “전체 어둡게” → `mix_darker`
- “멈춰” → `panic`

**Verification:**
```bash
cd /home/jisub-lee/workspace/live-loop/frontend
npm test -- --run src/loopState.test.ts src/music/applyMusicPatch.test.ts
```

---

## Phase 3 — Tone.js Engine Mapping

### Task 3.1: Add macro-to-Tone mapping helpers

**Objective:** Convert layer macro values into safe Tone.js parameter ranges.

**Files:**
- Create: `frontend/src/music/toneMacroMapping.ts`
- Create: `frontend/src/music/toneMacroMapping.test.ts`

**Mappings v0:**
- bass cutoff macro → baseFrequency/filter behavior safe range.
- bass resonance macro → `filter.Q` safe range.
- bass attack/decay macro → envelope values.
- pad width/reverb macro → reverb wet/spread-like behavior.
- hats brightness/decay macro → fallback synth/sample EQ-ready values.
- kick punch/body/click macro → fallback MembraneSynth/sample gain-ready values.

**Tests:**
- All mappings return finite values.
- No mapping returns negative frequency/time.
- Values stay in declared safe ranges.

**Verification:**
```bash
cd /home/jisub-lee/workspace/live-loop/frontend
npm test -- --run src/music/toneMacroMapping.test.ts
```

### Task 3.2: Apply macros in audioEngine.update()

**Objective:** Make audible changes from patch macros without recreating the graph unnecessarily.

**Files:**
- Modify: `frontend/src/audioEngine.ts`

**Implementation notes:**
- Keep graph stable.
- Use `rampTo` or direct safe assignments where appropriate.
- Do not dispose/recreate nodes in normal patch updates.
- Preserve current scheduling behavior.
- Use current `LoopState.layers[layer].macros` and `instrumentPreset`.

**Manual smoke:**
1. Start frontend/backend.
2. Add bass.
3. Apply “베이스 더 둥글게”.
4. Confirm audible darker/warmer bass.
5. Apply “하이햇 더 잘게”.
6. Confirm density/pattern change.

**Automated verification:**
```bash
cd /home/jisub-lee/workspace/live-loop/frontend
npm test -- --run
npm run build
npm run lint
```

### Task 3.3: Add emergency panic engine API

**Objective:** Provide a true immediate safety path separate from musical next-bar mute.

**Files:**
- Modify: `frontend/src/audioEngine.ts`
- Modify: `frontend/src/App.tsx`

**Behavior:**
- Cancel pending schedules.
- Mute master quickly or stop transport safely.
- Release synth voices where possible.
- Stop active players where possible.
- Disable all layers in state.

**Verification:**
Manual:
1. Start a dense loop.
2. Trigger “panic” / “멈춰”.
3. Confirm immediate silence, not delayed next-bar only.

---

## Phase 4 — LLM Patch Endpoint

### Task 4.1: Add Python MusicPatch response schema

**Objective:** Move backend LLM output from broad style intent toward verified patch selection.

**Files:**
- Create: `src/live_loop/music_patch.py`
- Create: `tests/test_music_patch.py`

**Schema:**
```py
class PatchInterpretation(BaseModel):
    patch_ids: list[str]
    timing: Literal['now', 'next_bar', 'next_2bar', 'next_4bar'] = 'next_bar'
    preserve: list[str] = []
    confidence: float = Field(ge=0, le=1, default=0.7)
    reason: str = ''
```

**Tests:**
- Unknown patch ids rejected or filtered.
- Duplicate patch ids deduped.
- Low confidence preserved for frontend decision.
- Panic timing forced to now.

**Verification:**
```bash
cd /home/jisub-lee/workspace/live-loop
uv run pytest tests/test_music_patch.py -q
```

### Task 4.2: Add `/api/llm/patch` endpoint

**Objective:** Interpret STT text plus current state summary into patch ids.

**Files:**
- Modify: `src/live_loop/api.py`
- Modify: `src/live_loop/local_llm.py`
- Create/Modify: `tests/test_api.py`, `tests/test_local_llm.py`

**Request shape:**
```json
{
  "text": "베이스 좀 더 둥글게",
  "state_summary": {
    "active_layers": ["kick", "hats"],
    "style": "house",
    "pending_changes": []
  }
}
```

**Response shape:**
```json
{
  "ok": true,
  "patch": {
    "patch_ids": ["add_bass", "bass_warmer"],
    "timing": "next_bar",
    "preserve": ["kick_pattern", "groove"],
    "confidence": 0.9,
    "reason": "bass is absent, so add it before warming the tone"
  },
  "source": "local-gguf"
}
```

**Fallback behavior:**
- If LLM missing/fails, use deterministic patch rules.
- Return `source: rules-fallback` and reason.

**Verification:**
```bash
cd /home/jisub-lee/workspace/live-loop
uv run pytest tests/test_api.py tests/test_local_llm.py tests/test_music_patch.py -q
curl -s -X POST http://127.0.0.1:8101/api/llm/patch \
  -H 'Content-Type: application/json' \
  -d '{"text":"베이스 좀 더 둥글게","state_summary":{"active_layers":["kick","hats"]}}'
```

### Task 4.3: Frontend consumes `/api/llm/patch`

**Objective:** Use LLM patch endpoint in opt-in mode while keeping deterministic fallback.

**Files:**
- Modify: `frontend/src/apiClient.ts`
- Create/Modify: frontend tests as needed.

**Behavior:**
- `VITE_LIVE_LOOP_USE_LOCAL_LLM=1` calls `/api/llm/patch`.
- Validate returned patch ids exist in frontend catalog.
- Apply patch ids through `applyMusicPatch` reducer.
- If LLM times out or returns invalid patch, fallback to local deterministic patch selection.
- Display source/latency.

**Verification:**
```bash
cd /home/jisub-lee/workspace/live-loop/frontend
npm test -- --run
npm run build
npm run lint
```

---

## Phase 5 — MVP Runtime QA

### Task 5.1: Restart and verify servers with LLM patch mode

**Objective:** Launch a testable local dev stack.

**Commands:**
```bash
cd /home/jisub-lee/workspace/live-loop
uv run live-loop-api

cd /home/jisub-lee/workspace/live-loop/frontend
VITE_LIVE_LOOP_ENABLE_TEXT_INPUT=1 \
VITE_LIVE_LOOP_USE_LOCAL_LLM=1 \
VITE_LIVE_LOOP_LLM_TIMEOUT_MS=12000 \
VITE_LIVE_LOOP_STT_TIMEOUT_MS=60000 \
npm run dev -- --host 0.0.0.0
```

**Health checks:**
```bash
curl -s http://127.0.0.1:8101/api/health
curl -s http://127.0.0.1:8101/api/stt/status
curl -s http://127.0.0.1:8101/api/model/status
curl -s -I http://127.0.0.1:5173/
```

### Task 5.2: Manual MVP test script

**Objective:** Confirm the agreed demo works with STT/text and scheduled audible changes.

**Test commands:**
1. `킥 깔아줘`
2. `하이햇 얹어줘`
3. `베이스 둥글게 넣어줘`
4. `킥은 유지하고 드럼 더 몰아줘`
5. `패드 넓게 깔아줘`
6. `전체 좀 어둡게`
7. `베이스 잠깐 빼`
8. `다시 드랍`
9. `멈춰`

**Pass criteria:**
- Each command maps to known patch ids.
- UI shows heard text/source/latency/pending timing.
- Audio changes happen at next safe boundary unless panic.
- Existing groove is preserved where requested.
- Panic is immediate.

### Task 5.3: Verification gate before expanding Patch/DSL

**Objective:** Ensure MVP is stable before growing the catalog.

**Commands:**
```bash
cd /home/jisub-lee/workspace/live-loop
uv run pytest -q
uv run ruff check .
cd frontend
npm test -- --run
npm run build
npm run lint
```

**Gate:** All commands must pass. If not, fix before adding new patch data.

---

## Phase 6 — Patch/DSL Growth Loop

After MVP passes manual QA, grow the verified catalog iteratively.

### Growth cycle

1. User tests natural commands.
2. Log commands that fail, feel wrong, or need nuance.
3. Classify each issue:
   - missing semantic mapping
   - missing patch preset
   - bad macro intensity
   - bad engine mapping
   - wrong preserve rule
   - timing issue
4. Add one or two patch/DSL entries.
5. Add tests.
6. Run full verification.
7. Repeat.

### Patch expansion priorities

1. More current-instrument changes:
   - bass: rounder, dirtier, shorter, longer, wider, darker, more plucky.
   - kick: deeper, punchier, softer, tighter, less clicky.
   - hats: softer, brighter, shuffled, more open, less sharp.
   - pad: wider, darker, airier, less wet, more motion.
2. Pattern DSL:
   - density
   - syncopation
   - ghost notes
   - subdivision
   - velocity humanization
   - chord/pad rhythm
3. Section patches:
   - build
   - drop
   - breakdown
   - strip drums
   - return bass
4. Style patches:
   - house
   - UK garage
   - techno
   - ambient

---

## Phase 7 — Productization

### Productization milestones

1. Stable MVP web app.
2. Local backend auto-start script.
3. Model/STT readiness overlay.
4. One-click desktop shell candidate: Tauri first, Electron fallback.
5. Runtime asset/model packaging policy.
6. Crash/restart UI for backend sidecar.
7. Patch/DSL editor/dev overlay.
8. Performance mode visualizer-only UI.
9. Release smoke checklist.

### Release readiness checklist

- No terminal required for end user.
- App starts with local sidecars.
- Missing STT/LLM models are visible and non-fatal.
- Basic deterministic commands work without LLM.
- LLM patch mode works when model exists.
- Panic always works.
- Visualizer reads real audio analyser data.
- Local model files are excluded from git.
- Full tests/build/lint pass.

---

## Global Verification Commands

Run before claiming any implementation milestone:

```bash
cd /home/jisub-lee/workspace/live-loop
uv run pytest -q
uv run ruff check .
cd frontend
npm test -- --run
npm run build
npm run lint
```

---

## Immediate Next Step

Implement Phase 0 and Phase 1 first:

1. Product definition document.
2. Tone.js capability audit.
3. MusicPatch schema.
4. Instrument capability catalog.
5. LoopState macro/preset extension.

Do not connect LLM to new patches until deterministic patch application and audio macro mapping are tested.
