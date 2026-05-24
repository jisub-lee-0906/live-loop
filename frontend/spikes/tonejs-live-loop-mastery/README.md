# Tone.js Live-loop Mastery Spike

Throwaway browser spike for learning Tone.js behavior before changing production `audioEngine.ts`.

## How to run

```bash
cd /home/jisub-lee/workspace/live-loop/frontend
npm run spike:tone
```

Open the printed Vite URL. Use headphones/speakers at safe volume.

## Experiments in this harness

1. Transport boundary/order logging
2. Loop vs Part/Sequence scheduling feel
3. Safe gain/filter/reverb ramping
4. Bass macro audition
5. Pad space audition
6. Analyzer truth check: empty transport should stay visually idle

## Verdict template

For each experiment, record:

- Result: VALIDATED / PARTIAL / INVALIDATED
- What was heard
- What logs showed
- Production rule to update
- Whether registry exposure is allowed

## Verdict log

### Panic behavior — PARTIAL / root cause found

User QA: pressing `PANIC` felt like it stopped and then started again.

Root cause in the spike harness: panic only ramped `master.gain` down, canceled scheduled events, then automatically ramped master gain back up after 150ms while transport/loop state could still feel alive. That behavior is not a real emergency stop.

Policy: panic must be immediate stop semantics, not musical mute semantics.

Applied spike harness change:

- `Tone.Transport.stop()`
- `Tone.Transport.cancel()`
- reset `Tone.Transport.position`
- `loop.stop()` and `step = 0`
- disable kick layer
- release active synth voices
- no delayed auto-restart feeling

Production implication: text/voice `panic` / `멈춰` / `정지` should classify as `immediate`, cancel pending schedules, stop the engine, and set `isPlaying=false`. Normal layer mute commands like `베이스 빼` remain quantized to `next_bar`.

### 001 transport-boundary-order — VALIDATED

User log showed that a `Tone.Transport.scheduleOnce()` state update scheduled exactly at the same downbeat as the production-style `Tone.Loop('16n')` can run after the loop callback:

```text
pos=17:0:0.139 loop callback step=0, kickEnabled=false
pos=17:0:0.139 APPLIED kickEnabled=true at scheduled boundary
```

Root cause: scheduling state application exactly on the target bar is too late for the first downbeat.

Fix policy: production state updates must be scheduled a tiny musical tick before the target boundary while UI still reports the musical target bar.

Validated retest:

```text
scheduled kick enable at target=3:0:0, engineApplyAt=2:3:3.75
APPLIED kickEnabled=true just before target boundary 3:0:0
pos=3:0:0.277 loop callback step=0, kickEnabled=true
```

Production rule: keep target display as `next_bar`, but apply engine state at `previousBar:3:3.75` so the target downbeat hears the new state.

## Initial verdict

PARTIAL. Harness exists; browser/manual audio verification still required.
