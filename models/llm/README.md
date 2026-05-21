# Local LLM model slot

This project is intended to run with a bundled/local model, not an external API.

Default model path:

```text
models/llm/live-coder.gguf
```

Current development model:

```text
source repo: unsloth/Qwen3.5-0.8B-GGUF
source file: Qwen3.5-0.8B-Q4_K_M.gguf
local file: models/llm/live-coder.gguf
sha256: bd258782e35f7f458f8aced1adc053e6e92e89bc735ba3be89d38a06121dc517
size: 508 MiB
```

The actual model binary is intentionally gitignored. Put the downloaded GGUF file here for development, or set:

```bash
export LIVE_LOOP_LLM_MODEL=/absolute/path/to/your/model.gguf
```

Recommended target for the first embedded prototype:

- 0.8B-4B instruct model depending on latency/quality target
- GGUF quantization: Q4_K_M or Q5_K_M
- Korean/English instruction following good enough for short music commands
- local runtime: `llama-cpp-python` in development; bundled llama.cpp server/runtime in the packaged app

Why not API-first:

- live instrument latency must stay under user control
- packaged app should work offline
- model crash/readiness should be visible in GUI
- API can remain optional dev fallback, but not the product default

Current backend status endpoint:

```text
GET /api/model/status
```

It reports whether the local GGUF file and runtime are ready.
