# live-loop

Voice-controlled live loop / local AI performance instrument prototype.

Current direction: GUI/Tone.js-first. Sonic Pi remains an optional OSC prototype adapter, but the main product path is a fullscreen browser/desktop instrument with local audio, visualizer, push-to-talk STT, and local GGUF intent parsing.

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

## Quick health check

```bash
cd /home/jisub-lee/workspace/live-loop
uv run live-loop doctor
uv run live-loop doctor --json
```

The doctor command reports:

- STT runtime/model/language/device/compute readiness.
- LLM model path/runtime readiness.

## LLM latency benchmark

Measure local GGUF cold/warm command latency before changing frontend timeouts:

```bash
cd /home/jisub-lee/workspace/live-loop
uv run live-loop benchmark-llm
uv run live-loop benchmark-llm --json
uv run live-loop benchmark-llm --prompt "킥 깔아줘" --prompt "하이햇 셔플로 얹어줘"
```

The first sample is treated as cold latency because it may include lazy model load. Later samples estimate warm latency. Keep this benchmark off the audio clock; frontend command application should still schedule to safe bar/phrase boundaries.

If local LLM mode is enabled in the frontend, call `/api/llm/prewarm` after backend startup or during an explicit splash/loading step. Prewarm can take several seconds on CPU, so it should never block Tone.js transport or a live bar transition.

## One-command development runtime

Start or verify the local performance stack with one command:

```bash
cd /home/jisub-lee/workspace/live-loop
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
cd /home/jisub-lee/workspace/live-loop
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
cd /home/jisub-lee/workspace/live-loop/frontend
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
cd /home/jisub-lee/workspace/live-loop
uv run pytest -q
uv run ruff check .
cd frontend
npm test -- --run
npm run lint
npm run build
```

Expected current status:

- Python tests pass.
- Ruff passes.
- Frontend tests pass.
- Frontend lint/build pass.
- Vite may warn that the production JS chunk is large because visualizer dependencies are bundled eagerly; this is a known optimization target.

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
2. Measure STT and LLM cold/warm latency.
3. Add startup/prewarm and better fallback behavior if needed.
4. Add Tauri desktop shell with managed backend sidecar.
5. Package sample assets, model downloader/installer, and one-click Windows runtime.

## Architectural decision

Do not fork Sonic Pi to embed STT/LLM. STT, LLM, command interpretation, state, and safety checks live in `live-loop`. Sonic Pi can remain an optional out-of-process adapter through OSC. See `docs/adr-0001-sonic-pi-integration-boundary.md`.
