# Architecture Decision Record: do not fork Sonic Pi for STT/LLM

Date: 2026-05-20

## Decision

`live-loop` will not modify Sonic Pi source code to embed STT and LLM directly into Sonic Pi.

Instead:
- Sonic Pi remains the real-time audio/live coding runtime.
- `live-loop` owns STT, LLM, command interpretation, state, and safety checks.
- The integration boundary is OSC.
- For portability, `live-loop` may bundle/launch a Sonic Pi runtime under `runtime/sonic-pi/`, but it will still communicate over OSC.

## Why

Sonic Pi is a full app/runtime with GUI, Ruby server components, SuperCollider/audio engine, and OSC interfaces. Embedding STT/LLM into Sonic Pi would require maintaining a fork across GUI, server, audio, packaging, and dependency layers.

That creates high risk:
- harder upgrades when Sonic Pi releases new versions
- more difficult Windows packaging
- potential real-time audio instability from STT/LLM latency
- larger dependency/runtime conflicts
- much slower iteration for the actual musical UX

## Allowed future exception

A thin Sonic Pi plugin/extension may be considered later if we need better auto-loading, UI hooks, or session bootstrapping.

Even then, STT/LLM should remain out-of-process and communicate through a stable protocol.
