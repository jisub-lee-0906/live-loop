# live-loop

Free, open-source, local-first AI performance instrument prototype.

`live-loop` is not an AI song generator and not a DAW replacement. It is a voice-directed live ensemble: the performer speaks musical intent, AI translates that intent into safe declarative music data, and the runtime performs only validated PatternDSL/MusicPlan changes at bar or phrase boundaries.

The core project is intended to remain free. If it becomes useful in your music, performances, teaching, or research, voluntary sponsorship/donation is the preferred support model.

Current direction: GUI/Tone.js-first. Sonic Pi remains an optional OSC prototype adapter, but the main product path is a fullscreen browser/desktop instrument with local audio, visualizer, push-to-talk STT, and local GGUF intent parsing.

## Project principles

- Local-first: microphone/STT/LLM workflows should work locally where practical.
- Performer-led: AI interprets direction; it does not take over the performance.
- Safe by design: no generated Tone.js/JS is executed in the live path.
- Musical timing first: changes are scheduled to safe bar/phrase boundaries.
- Hackable instrument: core code is MIT-licensed and intended for experimentation.
- Donation-supported: core features should not be paywalled.

## What it does now

- React/Vite fullscreen performance UI.
- Tone.js loop engine for drums, bass, and pad layers.
- Butterchurn/MilkDrop-style visualizer.
- Push-to-talk voice input from the browser.
- Python FastAPI backend for health, command parsing, STT, and local LLM intent parsing.
- faster-whisper Korean STT defaults: `small`, `cpu`, `int8`.
- Local GGUF LLM boundary through `llama-cpp-python`.
- Safe musical scheduling: voice/LLM commands are planned for bar or phrase boundaries instead of being applied mid-bar.

## Repository layout

```text
src/live_loop/          Python backend, CLI, STT/LLM boundaries, action schema
frontend/               React/Vite/Tone.js/Butterchurn performance UI
sonic_pi/               Optional Sonic Pi OSC prototype runtime
docs/                   Architecture and packaging notes
models/                 Local model slots and metadata; large model files stay out of git policy
runtime/                Local runtime/download area; ignored
```

## License and support

Code is released under the MIT License; see `LICENSE`.

Important: bundled code, AI models, audio samples, and visual presets can have different licenses. Large or restricted models should stay out of git and keep their upstream license terms. See `docs/licensing-and-sustainability.md` for the project policy.

Support model: free core project, optional donations/sponsorship later. Suggested message:

```text
This instrument is free because musical tools should be hackable, local, and accessible.
If live-loop helps your music, performance, teaching, or research, please consider sponsoring development.
```

## Quick health check

```bash
cd E:\workspace\live-loop
uv run live-loop doctor
uv run live-loop doctor --json
```

The doctor command reports:

- STT runtime/model/language/device/compute readiness.
- LLM model path/runtime readiness.

## LLM latency benchmark

Measure local GGUF cold/warm command latency before changing frontend timeouts:

```bash
cd E:\workspace\live-loop
uv run live-loop benchmark-llm
uv run live-loop benchmark-llm --json
uv run live-loop benchmark-llm --prompt "킥 깔아줘" --prompt "하이햇 셔플로 얹어줘"
```

The first sample is treated as cold latency because it may include lazy model load. Later samples estimate warm latency. Keep this benchmark off the audio clock; frontend command application should still schedule to safe bar/phrase boundaries.

If local LLM mode is enabled in the frontend, call `/api/llm/prewarm` after backend startup or during an explicit splash/loading step. Prewarm can take several seconds on CPU, so it should never block Tone.js transport or a live bar transition.

## One-command development runtime

Start or verify the local performance stack with one command:

```bash
cd E:\workspace\live-loop
scripts/start-dev-runtime.py --prewarm
```

Useful modes:

```bash
# Verify already-running backend/frontend and prewarm local AI paths.
scripts/start-dev-runtime.py --check-only --prewarm

# Start missing servers, verify readiness, then exit instead of staying attached.
scripts/start-dev-runtime.py --no-wait
```

The launcher checks backend `8101`, frontend `5173`, `/api/health`, `/api/stt/status`, `/api/model/status`, and frontend `/`. It also points to `docs/qa/golden-performance-flow.md` for manual QA.

## Backend development

Run only the API:

```bash
cd E:\workspace\live-loop
uv run live-loop-api
```

Default API base expected by the frontend:

```text
http://127.0.0.1:8101
```

Useful checks:

```bash
curl -sS http://127.0.0.1:8101/api/health
curl -sS http://127.0.0.1:8101/api/stt/status
curl -sS http://127.0.0.1:8101/api/model/status
curl -sS -X POST http://127.0.0.1:8101/api/llm/prewarm
curl -sS -X POST http://127.0.0.1:8101/api/llm/intent \
  -H 'Content-Type: application/json' \
  -d '{"text":"UK garage 느낌으로 셔플 하이햇 얹어줘"}'
```

## Frontend development

```bash
cd E:\workspace\live-loop/frontend
npm run dev
```

Useful environment flags:

```bash
# Enable the hidden debug text input opened by `/`.
VITE_LIVE_LOOP_ENABLE_TEXT_INPUT=1 npm run dev

# Route commands through backend /api/command.
VITE_LIVE_LOOP_USE_BACKEND_COMMANDS=1 npm run dev

# Route natural-language commands through backend /api/llm/intent.
VITE_LIVE_LOOP_USE_LOCAL_LLM=1 npm run dev
```

Performance controls:

- Click visualizer or press Space: start demo / toggle transport.
- Hold `V`: push-to-talk voice input.
- Hold the on-screen talk button: push-to-talk voice input.
- `[` / `]`: previous/next visual preset.
- `/`: open debug text input only when `VITE_LIVE_LOOP_ENABLE_TEXT_INPUT=1`.

## Verification

Run all current checks:

```bash
cd E:\workspace\live-loop
uv run pytest -q
uv run ruff check .
cd frontend
npm test -- --run
npm run lint
npm run build
```

Check criteria and limitations:

- Treat passing Python, frontend test, lint, and build commands as environment-specific verification, not proof that microphone, STT, LLM, or audio output will work on a performance machine.
- The repository does not include STT or GGUF model files. Install compatible local models separately and use `live-loop doctor` before a session.
- Vite may warn that the production JS chunk is large because visualizer dependencies are bundled eagerly; this remains an optimization target.

## Model/runtime notes

LLM:

- Default path: `models/llm/live-coder.gguf`.
- Override with `LIVE_LOOP_LLM_MODEL=/absolute/path/to/model.gguf`.
- Runtime: `llama-cpp-python`.

STT:

- Defaults: `LIVE_LOOP_STT_MODEL=small`, `LIVE_LOOP_STT_LANGUAGE=ko`, `LIVE_LOOP_STT_DEVICE=cpu`, `LIVE_LOOP_STT_COMPUTE_TYPE=int8`.
- Override those environment variables for experiments.
- Keep STT/LLM latency outside the audio clock; frontend scheduling must remain safe at bar/phrase boundaries.

## Project phases

Original phases:

- Phase 0: project scaffold + OSC smoke test.
- Phase 1: text command loop station.
- Phase 2: Korean natural-language command parser.
- Phase 3: push-to-talk STT.
- Phase 4: LLM -> safe JSON music actions.
- Phase 5: small performance UI / state monitor.

Current product path:

1. Stabilize browser performance UX: fullscreen visualizer, PTT STT, local command scheduling.
2. Move beyond fixed presets with a Musical Intent State layer: energy, tension, density, space, promise, focus, and silence/withholding as first-class musical concepts.
3. Add role-based ensemble reactions: drummer, bassist, lead, texture, FX, and silence generate validated MusicPlan/PatternDSL data.
4. Add seeded variation and motif memory so “다른 느낌으로”, “방금 거 기억해”, and “다시 불러” feel musical but remain reproducible.
5. Measure STT and LLM cold/warm latency, then add startup/prewarm and better fallback behavior if needed.
6. Add Tauri desktop shell with managed backend sidecar.
7. Package only license-clean sample assets, model downloader/installer, and one-click Windows runtime.

## Architectural decision

Do not fork Sonic Pi to embed STT/LLM. STT, LLM, command interpretation, state, and safety checks live in `live-loop`. Sonic Pi can remain an optional out-of-process adapter through OSC. See `docs/adr-0001-sonic-pi-integration-boundary.md`.
