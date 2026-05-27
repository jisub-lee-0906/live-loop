# One-Click Desktop Runtime Plan

Goal: user double-clicks one app and `live-loop` opens as a polished desktop instrument: GUI, audio engine, visualizer, local STT/LLM services, and project/session state.

## Recommended final packaging

Use a desktop shell with a built frontend and managed sidecar processes.

Preferred path:

```text
Tauri app
  WebView frontend: React/Vite/Tone.js visual loopstation
  Sidecar backend: Python FastAPI compiled/bundled executable
  Sidecar model runtimes: llama.cpp / whisper.cpp or packaged Python wheels
  Assets: samples, presets, schemas, default project templates
```

Why Tauri first:
- lighter than Electron
- good for one-click desktop apps
- can bundle sidecar binaries
- frontend visualizer remains normal web tech

Electron is the fallback if Tauri sidecar/model packaging becomes too painful.

## User experience target

User sees only:

1. Double-click `Live Loop.exe`.
2. Splash screen: "오디오 엔진 준비 중", "마이크 준비 중", "로컬 AI 준비 중".
3. Main window opens.
4. Click Start or press push-to-talk.
5. Say: "킥 깔아줘", "하이햇 얹어줘", "드럼 더 쪼개줘".

No terminal, no Linux-bridge dependency, no manual server start.

## Runtime architecture

```text
Live Loop.exe
  ├─ Frontend window
  │   ├─ React UI
  │   ├─ Tone.js transport/audio graph
  │   ├─ Web Audio AnalyserNode visualizer
  │   └─ layer cards / command log / meters
  │
  ├─ Backend sidecar
  │   ├─ /api/health
  │   ├─ /api/command
  │   ├─ /api/stt/transcribe
  │   ├─ /api/llm/interpret
  │   └─ config/session persistence
  │
  └─ Optional local model sidecars
      ├─ whisper.cpp or faster-whisper runtime
      └─ llama.cpp server or embedded local LLM runner
```

Important: audio should stay in the frontend/Tone.js path at first. STT/LLM latency must not block the audio clock.

## Development phases

### Phase 1: Dev web app

- Vite + React + TypeScript
- Tone.js loop transport
- text command input
- waveform/spectrum visualizer
- no desktop packaging yet

Run:

```bash
cd frontend
npm run dev
```

Acceptance:
- browser plays kick/hats/bass layers
- visualizer responds
- text commands mutate layer state

### Phase 2: Local backend

- Python FastAPI backend
- command interpreter endpoint
- later STT and LLM endpoints

Run:

```bash
uv run live-loop-api
```

Acceptance:
- frontend calls backend `/api/command`
- same action schema used by tests and UI

### Phase 3: Desktop shell

- Add Tauri wrapper
- Tauri launches frontend build
- Tauri starts/stops backend sidecar

Acceptance:
- `npm run tauri dev` opens one window and backend is available

### Phase 4: Model sidecars

- local 4B LLM via llama.cpp/OpenAI-compatible local server or embedded runner
- local STT via whisper.cpp/faster-whisper
- model files stored outside git under `runtime/models/`

Acceptance:
- app works offline after models are installed
- API fallback optional, not required

### Phase 5: Release packaging

- Build Windows installer or portable folder
- Include samples/presets
- Include backend executable
- Include model downloader or first-run setup

Acceptance:
- fresh Windows machine can run app with no terminal
- first-run setup explains missing model/download status clearly

## One-click constraints

- No Linux-bridge requirement for end users.
- No command prompt window left open.
- Backend crashes should show a GUI error with restart button.
- Audio engine starts only after user gesture due to browser/WebView audio policies.
- Models may be optional on first run; app should still open in text-command/demo mode.
- API keys must be optional and stored in user config, not bundled.

## Packaging strategy for models

Do not commit model binaries.

Options:
1. Small default mode: ship no model, text commands + rules only.
2. First-run downloader: download STT/LLM models into user data dir.
3. Pro portable pack: separate zip containing models under `runtime/models/`.

Recommended first release:
- app bundle includes UI, backend, sample pack, rules parser
- model downloader can install local STT/LLM
- API fallback can be configured for development

## Current implication for this repo

The project should pivot from "Sonic Pi first" to "engine-adapter first":

```text
src/live_loop/          # Python backend/action schema
frontend/               # GUI + Tone.js audio engine
sonic_pi/               # optional prototype adapter only
runtime/                # ignored local runtimes/models
```

The Sonic Pi experiment can remain, but the one-click product path should be GUI/Tone.js-first.
