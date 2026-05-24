# live-loop Product Definition

`live-loop` is a voice-controlled local AI live-coding loop instrument.

The user builds and mutates a live loop by speaking Korean/English musical directions. The system transcribes speech, interprets text with deterministic rules and/or a local LLM, converts intent into validated MusicPatch/PatternDSL changes, and applies them through Tone.js at safe bar/phrase boundaries.

## One-line definition

A local AI live instrument where the user conducts by voice, the LLM translates natural language into verified musical patches, and the algorithmic audio engine performs them safely in time.

## Core identity

- Not a full-song generator.
- Not a chatbot that happens to make sound.
- Not a toy preset loopstation.
- Not an arbitrary live JavaScript executor.
- It is an algorithmic live music engine with a natural-language LLM bridge.

## Product principles

1. Start from silence / empty transport.
2. User remains the conductor.
3. LLM is the semantic bridge, not the audio engine.
4. LLM output must be verified data, not executable code.
5. Current groove preservation is as important as change.
6. Audio clock must never block on STT/LLM latency.
7. All musical changes default to quantized timing.
8. Panic, undo, and safe mute are required before deeper autonomy.
9. Performance UI is visualizer-first; debug surfaces are overlays/dev mode.
10. Local-first operation is the target; APIs are optional development fallbacks.

## Main runtime flow

```text
User voice
  -> Push-to-talk STT
  -> text command
  -> deterministic parser and/or local LLM
  -> MusicPatch / PatternDSL selection or composition
  -> validator
  -> LoopState update planning
  -> quantized scheduler
  -> Tone.js / Web Audio engine
  -> sound + visualizer feedback
```

## LLM role

The LLM interprets human musical language into safe, verified musical data.

Examples:

- “베이스 좀 더 둥글게” -> `bass_warmer`
- “킥은 유지하고 드럼 더 몰아줘” -> `drums_busier_preserve_kick`
- “위에 공간감만 줘” -> `add_pad` + `pad_wider`, preserving drums/bass
- “전체 좀 어둡게” -> `mix_darker`

The LLM should compose parameterized MusicPlan/PatternDSL changes from current LoopState context: preserve constraints, roles, event density, timing, intensity, macro ranges, and transition shape. It must not generate arbitrary Tone.js/JavaScript for direct execution in the live path, and it also must not be reduced to choosing from a growing hardcoded preset menu.

## Algorithmic engine role

The engine owns actual musical behavior:

- layer state
- safe instrument primitives
- macro parameters and automation curves
- pattern events
- density/swing/humanize algorithms
- timing/scheduling
- volume/mix/safety limits
- panic/undo behavior

The engine only applies validated patches and DSL patterns.

## MVP acceptance demo

From a fresh page:

1. User starts empty transport.
2. Says “킥 깔아줘” -> kick enters next bar.
3. Says “하이햇 얹어줘” -> hats enter next bar.
4. Says “베이스 둥글게 넣어줘” -> bass enters with warmer/darker tone.
5. Says “킥은 유지하고 드럼 더 몰아줘” -> kick preserved, hats/snare density increases.
6. Says “패드 넓게 깔아줘” -> pad enters wider/reverb-heavy.
7. Says “전체 좀 어둡게” -> mix/available layers become darker.
8. Says “베이스 잠깐 빼” -> bass mutes without deleting its sound settings.
9. Says “다시 드랍” -> bass returns and energy increases.
10. Says “멈춰” or “panic” -> immediate safe mute/stop path works.

## Non-goals for the live path

- No arbitrary LLM-generated JS/Tone.js execution.
- No always-on STT as the default early interface.
- No blocking audio transport while waiting for STT/LLM.
- No full arrangement auto-generation as the MVP center.
- No dashboard-first UI as the primary performance surface.
- No unbounded audio parameters, unsafe volume jumps, or unvalidated sample/effect loading.

## Growth model

After MVP, grow the verified capability/DSL system iteratively. Do not grow by adding more fixed phrase -> preset mappings as the main creative path.

1. User tests natural commands.
2. Failed or weak commands are logged.
3. Each issue is classified as missing semantic mapping, missing parameter/range, weak generated events, wrong preserve rule, engine mapping issue, or timing issue.
4. Prefer adding a parameterized generator, macro range, validation rule, or PatternDSL transform. Add a fixed patch only when it is a low-level safety primitive/fallback.
5. Add tests.
6. Run full verification.
7. Repeat.
