# Golden Performance Flow QA

Purpose: prove `live-loop` behaves like a finished voice-controlled instrument, not only a passing codebase.

Run this checklist after any productization, STT, scheduler, Tone.js, visualizer, or command-path change.

## Required runtime

Backend:
- `/api/health` returns OK.
- `/api/stt/status` reports ready when testing voice.
- `/api/model/status` reports ready or clearly explains fallback mode.

Frontend:
- Vite or packaged app opens the performance UI.
- Text debug input may be enabled for Step A, but the final pass must use PTT.

Audio:
- Use the real output device intended for testing.
- Keep volume moderate before SOUND CHECK.
- If testing STT while speakers are audible, verify PTT ducking is enabled.

## Pass labels

Use:
- PASS: behaves as expected.
- FAIL: blocks the flow.
- FEEL: works technically but musical feel/sound needs tuning.
- NOTE: observation that does not block the flow.

## Step A — Text-command baseline

Text mode proves the music state/scheduler/audio path without microphone or Whisper variables.

| Step | Action | Expected UI | Expected audio/visual result | Result |
| --- | --- | --- | --- | --- |
| A1 | Fresh load | READY | No sound. Visualizer idle/static. |  |
| A2 | Press SOUND CHECK | SOUND CHECK · FOUR KICKS | Four musical kicks only. No loop layer remains active. |  |
| A3 | Start empty transport | EMPTY LOOP | Transport can run, no audible layer, visualizer idle/static. |  |
| A4 | Text: `킥 깔아줘` | QUEUED · NEXT BAR, then APPLIED | Kick enters on the next bar, not mid-bar. |  |
| A5 | Text: `하이햇 얹어줘. 살짝 셔플` | queued/applied | Hats enter, kick continues. Groove feels stable. |  |
| A6 | Text: `어두운 베이스 넣어줘` | queued/applied | Bass enters dark/round, not too loud. |  |
| A7 | Text: `리드 하나 반짝이게` | queued/applied | Sparse lead enters without masking drums/bass. |  |
| A8 | Text: `공간감만 좀 줘` | queued/applied | Texture/pad/space increases without replacing groove. |  |
| A9 | Text: `드랍 전에 숨 한번 참는 느낌으로 잘라줘` | queued next phrase or safe boundary | FX/automation transition is audible and phrase-safe. |  |
| A10 | Text: `베이스 잠깐 빼` | queued/applied | Bass mutes; other layers continue. |  |
| A11 | Text: `다시 드랍` | queued/applied | Bass returns and energy rises. |  |
| A12 | Text: `되돌려` | APPLIED or undo feedback | Previous musical state returns; no stale pending patch. |  |
| A13 | Press `S` or text `멈춰` | STOPPED | Transport stops safely; tails are natural or silence is clear. |  |
| A14 | Start again and `킥 깔아줘` | EMPTY LOOP -> queued/applied | App recovers after stop; no silent master-gain bug. |  |

Text baseline pass condition:
- A1–A14 have no blocking FAIL.
- FEEL issues are logged separately as sound-design/timing tuning tasks.

## Step B — PTT/STT performance pass

Voice mode proves the actual product interaction.

Before Step B:
- Warm STT once through backend or first PTT.
- If cold model load is expected, do not count the first warmup as the real test.
- Speak short clear Korean commands.
- Hold PTT a little before speaking and release a little after the final syllable.

| Step | Action | Expected UI | Expected audio/visual result | Result |
| --- | --- | --- | --- | --- |
| B1 | Fresh load | READY | No sound. Visualizer idle/static. |  |
| B2 | Press/hold PTT, say `킥 깔아줘` | LISTENING -> TRANSCRIBING -> HEARD -> QUEUED | Kick enters next bar. |  |
| B3 | While kick plays, PTT `하이햇 얹어줘` | Same as above | App ducks output while listening; hats enter next bar. |  |
| B4 | PTT `어두운 베이스 넣어줘` | Same as above | Bass enters; STT is not confused by loop bleed. |  |
| B5 | PTT `드럼 더 쪼개줘` | Same as above | Drum density increases; kick remains preserved. |  |
| B6 | PTT `베이스 잠깐 빼` | Same as above | Bass mutes without deleting settings. |  |
| B7 | PTT `다시 드랍` | Same as above | Bass returns; energy increases. |  |
| B8 | PTT `되돌려` | undo feedback | Previous state returns. |  |
| B9 | Say `멈춰` or press `S` | STOPPED | Safe stop, app can restart. |  |

PTT pass condition:
- No stale transcript applies after a newer command.
- No hallucinated non-command text causes a musical change.
- Output ducking is sufficient to prevent obvious loop bleed.
- Empty transcript is shown as no speech, not as a parser failure.

## Step C — Failure-mode checks

| Step | Action | Expected result | Result |
| --- | --- | --- | --- |
| C1 | Tap PTT too quickly | TOO SHORT or NO VOICE INPUT; no music change. |  |
| C2 | PTT silence | NO VOICE INPUT / NO SPEECH DETECTED; no music change. |  |
| C3 | Say unsupported phrase | Clear unsupported/ignored feedback; no hidden fallback surprise. |  |
| C4 | Stop while a command is queued | Pending schedule cancels; STOPPED; no later surprise apply. |  |
| C5 | Restart after STOP | Master output re-arms; SOUND CHECK and new kick are audible. |  |

## Step D — Sound/feel notes

Record subjective issues here. These do not necessarily block MVP control flow, but they define the sound identity pass.

- Kick feel:
- Hats groove:
- Bass loudness/tone:
- Pad/texture width:
- Lead density:
- FX transition usefulness:
- Clicks/pops:
- Visualizer alignment:
- PTT ducking comfort:

## Release decision

The MVP is ready for product-shell work when:

- Step A passes.
- Step B passes after STT warmup.
- Step C has no blocking unsafe behavior.
- Step D issues are tuning tasks, not broken control flow.

The project is not production-ready until this QA passes in the one-entrypoint/packaged runtime, not only in separate dev servers.
