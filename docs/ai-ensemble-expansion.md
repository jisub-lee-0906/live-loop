# AI Ensemble Expansion

Goal: move live-loop from a fixed 5-layer loopstation toward a voice-directed AI ensemble.

## Product shift

Old surface:

```text
kick / snare / hats / bass / pad on-off + small complexity changes
```

New spine:

```text
Voice command
  -> STT text
  -> deterministic fast path or LLM semantic planner
  -> verified MusicPlan / MusicPatch / PatternDSL
  -> role + preset + pattern + macro interpretation
  -> quantized scheduler
  -> Tone.js ensemble engine
  -> audible sound + visualizer feedback
```

## Rule

Input can be broad and musical. Output must stay constrained and validated.

The user can say:

- 하이햇 UK garage처럼 밀어줘
- 베이스 좀 둥글게 넣어줘
- 위에 반짝이는 아르페지오 살짝
- 킥은 유지하고 나머지 비워
- 두 마디 뒤에 드랍 느낌 줘
- 지금 너무 밝아, 어둡게

The runtime should convert that into safe data, not arbitrary generated Tone.js code.

## Ensemble roles v1

Existing roles:

- kick
- snare
- hats
- bass
- pad

Implemented ensemble expansion roles:

- lead: sparse melodic/arp/sparkle material above the groove
- texture: atmospheric/noise-bed material that adds air without replacing groove layers
- fx: transition gestures for riser sweep, drop impact, delay throw, and stutter gate

Next roles after these are hand-QA’d:

- harmony variants: organ stab, keys, drone
- percussion variants: shaker, rim, tom, click, open hat
- fx variants: reverse swell, tape stop, filtered fill

## Implementation plan pattern

1. Add the role or gesture as validated MusicPatch data.
2. Register supported presets/macros in the capability DB.
3. Add PatternDSL events so the role is not just state-only.
4. Resolve macros into Tone-safe runtime params before touching audio nodes.
5. Add Tone.js audible wiring with safe volume/filter/reverb/delay/envelope behavior.
6. Route Korean/English deterministic commands and backend intent constraints to the verified patch.
7. Keep all changes quantized; no arbitrary JS generation in the live path.

## Acceptance smoke

From a fresh browser:

1. Start empty transport.
2. Say/type `킥 깔아줘`.
3. Say/type `베이스 둥글게 넣어줘`.
4. Say/type `패드 넓게 깔아줘`.
5. Say/type `위에 반짝이는 아르페지오 살짝`.

Expected: the fourth command adds a clearly audible high melodic/sparkle layer without replacing the existing groove.
