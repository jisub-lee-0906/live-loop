# Seeded Pattern Variation Engine v0 Implementation Plan

> For Hermes: implement with strict TDD. Do not add production code before a failing test.

Goal: Move live-loop from fixed preset triggering toward a voice-directed AI ensemble by adding reproducible, safe PatternDSL variations for hats, bass, lead, and FX.

Architecture: Keep Tone.js as a validated interpreter, not a code-generation target. Natural-language commands choose a base intent/patch, then a seeded variation engine produces bounded PatternDSL events. All changes stay quantized to next bar/phrase and preserve groove anchors by default.

Tech Stack: TypeScript, Vitest, existing PatternDSL/MusicPatch/LoopState frontend pipeline, Python ArrangementPlan backend later.

---

## Reality Check

This is realistically feasible if scoped as “small musical variation inside validated DSL,” not as “AI composes a full new song every command.”

Feasible now:
- deterministic seeded RNG;
- hats/bass/lead/fx event variations;
- current LoopState-aware preserve rules;
- PatternDSL validation and tests;
- command phrases like “다른 느낌”, “변주”, “덜 뻔하게”.

Not feasible/reliable yet:
- unrestricted LLM-generated Tone.js code;
- fully autonomous arrangement that always sounds good;
- always-on mic musical understanding;
- complex harmony generation without more theory/rules/tests;
- production-quality audio feel without user ear QA.

Success criterion for v0: The same seed gives the same PatternDSL output, different variation seeds produce audibly different but safe loops, and kick/bass anchors do not unexpectedly disappear.

---

## Non-Negotiable Safety Rules

1. Never execute generated Tone.js/JS.
2. Variation output must be PatternDSL events/macros only.
3. Validate every step, voice, velocity, note, length, and event count.
4. Apply state at quantized boundaries, using existing pre-boundary apply rule where relevant.
5. Preserve enabled kick by default.
6. Preserve enabled bass unless user explicitly asks to remove/change bass.
7. Cap density per role:
   - hats: max 12 events / 16 steps in v0;
   - bass: max 6 events / 16 steps;
   - lead: max 5 events / 16 steps;
   - fx: phrase-end focused, max 6 events unless stutter intent.
8. Keep all velocities clamped to 0.0–1.0.
9. Keep bass/lead notes inside curated C minor note pools for now.
10. Do not expose a capability unless it is audible in runtime.

---

## Main Risks and Prevention

### Risk 1: “랜덤” 때문에 음악이 망가짐
Prevention:
- use seeded RNG, not Math.random;
- role-specific templates;
- density clamps;
- curated note pools;
- tests for deterministic output and limits.

### Risk 2: 기존 next-bar timing이 첫 박자에 늦게 적용됨
Prevention:
- do not rewrite scheduler in v0;
- keep existing quantized scheduling path;
- if scheduler touched, test pre-boundary apply behavior separately;
- manual QA must verify new layer enters on bar step 0.

### Risk 3: state는 바뀌는데 소리는 안 바뀜
Prevention:
- only generate PatternDSL events consumed by `resolvePlaybackStepEvents`/audio runtime;
- add tests through reducer/playback event path, not only pure generator tests;
- manual browser QA after automated tests.

### Risk 4: LLM path bypasses variation rules
Prevention:
- variation engine is a post-planner deterministic step;
- LLM may request variation intent, but cannot emit raw runtime code;
- backend plan fields should be declarative: seed, target, density, preserve.

### Risk 5: 프리셋 synonym만 계속 늘어남
Prevention:
- do not add more fixed catalog entries unless they are base sound identities;
- add variation profiles instead of new one-off patches.

### Risk 6: 사용자가 “다른 느낌”이라고 했는데 너무 달라짐
Prevention:
- “different” changes pattern surface, not core identity;
- preserve BPM/key/enabled anchors;
- add undo/history check before rollout.

---

## Task 1: Add seeded RNG utility

Objective: Provide deterministic pseudo-random helpers without using Math.random.

Files:
- Create: `frontend/src/seededRng.ts`
- Test: `frontend/src/seededRng.test.ts`

Tests first:
- same seed returns same sequence;
- different seed returns different sequence;
- `pick()` is deterministic;
- `range()` stays inside min/max.

Implementation notes:
- Use a tiny pure TypeScript hash + mulberry32/xorshift style RNG.
- API should be boring:
  - `createSeededRng(seed: string | number)`
  - `rng.next()` => 0..1
  - `rng.int(min, max)`
  - `rng.pick(items)`
  - `rng.chance(probability)`

Verification:
- Run: `npm run test -- seededRng.test.ts`
- Expected: all tests pass.

---

## Task 2: Add PatternDSL variation validation helpers

Objective: Centralize clamps and event validation so generators cannot leak unsafe data.

Files:
- Create: `frontend/src/patternVariation.ts`
- Test: `frontend/src/patternVariation.test.ts`

Tests first:
- clamps negative/high velocities;
- rejects or normalizes invalid steps into 0..15 policy; prefer reject/drop for v0;
- limits event count;
- preserves only allowed voices per target;
- bass notes must be from curated bass note pool;
- lead notes must be from curated lead note pool.

Implementation notes:
- Export pure functions:
  - `clampVelocity(value: number): number`
  - `sanitizePatternEvents(events, options): PatternEvent[]`
  - `deriveVariationSeed(sessionSeed, commandText, target, variationIndex)`
- Do not connect to UI yet.

Verification:
- Run: `npm run test -- patternVariation.test.ts`

---

## Task 3: Generate hats variations

Objective: Make hats the first audible variation target because it is musically low-risk.

Files:
- Modify: `frontend/src/patternVariation.ts`
- Test: `frontend/src/patternVariation.test.ts`

Tests first:
- same seed produces same hats events;
- different seed changes at least one step/velocity;
- max event count <= 12;
- all events voice=`hat`;
- step 0 should usually remain empty unless explicitly fill-oriented;
- velocities are clamped.

Implementation notes:
- Start from offbeat 8ths and optional 16th fill accents.
- Variation profiles: `steady`, `shuffle`, `busy`, `sparse`, `fill`.
- Do not change kick/snare events here.

Verification:
- `npm run test -- patternVariation.test.ts`

---

## Task 4: Generate bass variations

Objective: Produce safe bassline alternatives without breaking key/groove.

Files:
- Modify: `frontend/src/patternVariation.ts`
- Test: `frontend/src/patternVariation.test.ts`

Tests first:
- max event count <= 6;
- allowed notes only: C1/C2, Eb1/Eb2, G1/G2, Bb1/Bb2 initially;
- length only 16n/8n/4n;
- no duplicate same-step bass events;
- strong steps prefer 2/6/10/14 or safe syncopations.

Implementation notes:
- Provide small template families rather than free note generation.
- Use seed to choose template + octave + velocity accents.
- Keep “dark_sub” identity via macros, not event chaos.

Verification:
- `npm run test -- patternVariation.test.ts`

---

## Task 5: Generate lead variations

Objective: Make melodic variation sparse and controllable.

Files:
- Modify: `frontend/src/patternVariation.ts`
- Test: `frontend/src/patternVariation.test.ts`

Tests first:
- max event count <= 5;
- allowed notes only from C minor pentatonic/minor pool;
- no all-16th machine-gun output;
- different seed changes phrase contour;
- sparse profile has <= 3 events.

Implementation notes:
- Use call/response phrase templates.
- Prioritize rests; silence is acceptable.
- Avoid velocity > 0.55 for v0 unless explicit “앞으로/더 크게”.

Verification:
- `npm run test -- patternVariation.test.ts`

---

## Task 6: Generate FX phrase-end variations

Objective: Keep FX dramatic but phrase-safe.

Files:
- Modify: `frontend/src/patternVariation.ts`
- Test: `frontend/src/patternVariation.test.ts`

Tests first:
- riser/delay/stutter events mostly in steps 12..15;
- impact can include step 0 only for drop impact;
- max event count respected;
- automation curve start/end valid if generated;
- no FX events outside 0..15.

Implementation notes:
- Do not make FX constant background noise.
- Prefer phrase-end shapes.
- Reuse existing `AutomationCurve` types if needed.

Verification:
- `npm run test -- patternVariation.test.ts`

---

## Task 7: Connect variation commands to state path

Objective: Route “다른 느낌/변주/덜 뻔하게” into variation generation without bypassing MusicPatch validation.

Files:
- Modify: likely `frontend/src/loopState.ts`
- Modify: possibly `frontend/src/patchCatalog.ts` or `frontend/src/apiClient.ts`
- Test: `frontend/src/loopState.test.ts` and/or `frontend/src/apiClient.test.ts`

Tests first:
- command “다른 베이스로” changes bass pattern events but keeps bass enabled;
- command “하이햇 변주해줘” changes hats events only;
- command “덜 뻔하게” chooses active melodic/rhythmic target safely;
- command creates pending patch/state with next_bar timing;
- undo restores previous pattern.

Implementation notes:
- Use current LoopState to choose target if command is ambiguous.
- If no active layer exists, return helpful unsupported/no-op rather than adding everything.
- Keep existing deterministic patches for first add-layer commands.

Verification:
- `npm run test -- loopState.test.ts apiClient.test.ts`

---

## Task 8: Preserve planner provenance and preview

Objective: Make variation visible before it is heard so debugging is possible.

Files:
- Modify: existing debug plan/command log files as needed
- Test: `frontend/src/debugPlanSummary.test.ts`

Tests first:
- preview shows variation target;
- preview shows event count and timing;
- preview uses planned state when pending, not only audible current state.

Implementation notes:
- Keep display compact.
- Do not expose implementation-only pre-boundary timing to performer.

Verification:
- `npm run test -- debugPlanSummary.test.ts`

---

## Task 9: Backend ArrangementPlan extension, only after frontend v0 works

Objective: Let backend carry variation intent declaratively, without owning Tone.js details.

Files:
- Modify: `src/live_loop/arrangement_plan.py`
- Modify tests under backend test directory after locating existing tests.

Tests first:
- “다른 느낌” yields plan metadata for variation intent;
- preserve includes active kick/bass anchors from loop_state;
- no raw JS/Tone.js in response;
- all events validate through Pydantic.

Implementation notes:
- Add only minimal fields if needed:
  - `variation_intent`
  - `variation_seed` optional
  - `variation_strength` optional
- Keep backend rule planner a fallback, not final music brain.

Verification:
- Run backend pytest command used in repo.

---

## Task 10: Full verification and manual QA

Automated:
- `cd frontend && npm run test`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- backend pytest/lint if backend touched
- `git diff --check`

Runtime:
- start backend/frontend with existing launcher or two-process dev flow;
- verify `/api/health`, `/api/stt/status`, `/api/model/status`;
- verify frontend loads;
- test with text input first, then PTT.

Manual ear QA script:
1. Fresh page, empty transport: silence and visualizer idle.
2. “킥 깔아줘”: kick enters on next bar first beat.
3. “하이햇 얹어줘”: hats enter safely.
4. “하이햇 변주해줘”: hats differ, kick unchanged.
5. “어두운 베이스 넣어줘”: bass enters safely.
6. “다른 베이스로”: bassline changes but key/groove remains.
7. “리드 하나 얹어줘”: sparse lead appears.
8. “방금 리드 말고 더 단순하게”: lead becomes simpler, not louder/chaotic.
9. “드랍 전에 숨 한번 참자”: FX appears near phrase end.
10. Undo/stop: previous state restores; stop cancels pending changes.

Pass/fail criteria:
- Pass: variation is audible, bounded, reversible, and musically timed.
- Fail: first beat late, clicks, runaway density, anchor loss, visualizer moving without sound, or state-only changes with no audible difference.

---

## Recommended Implementation Order

Do not touch backend or LLM first.

1. Seeded RNG tests + utility.
2. Pattern variation tests + pure generator.
3. Hats variation only.
4. Connect hats variation to command path.
5. Browser QA.
6. Bass variation.
7. Browser QA.
8. Lead variation.
9. FX variation.
10. Backend metadata/planner integration.

This order avoids the biggest mistake: making the AI/planner more ambitious before the audio path proves small safe variations are actually audible.
