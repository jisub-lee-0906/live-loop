# live-loop

Voice-controlled live loop / Sonic Pi conductor prototype.

Concept:
- Build music layer-by-layer like a loop station.
- Use Python as the conductor/state manager.
- Use OSC to control Sonic Pi in real time.
- Start with text commands, then add STT, then add LLM interpretation.

MVP target:
1. Run a Sonic Pi script that listens for OSC messages.
2. Send commands from Python such as `kick`, `hats`, `bass`, `drums more complex`.
3. Sonic Pi updates layers at musical boundaries without stopping the loop.

Phases:
- Phase 0: project scaffold + OSC smoke test.
- Phase 1: text command loop station.
- Phase 2: Korean natural-language command parser.
- Phase 3: push-to-talk STT.
- Phase 4: LLM -> safe JSON music actions.
- Phase 5: small performance UI / state monitor.
