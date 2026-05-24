# Licensing, Sustainability, and Asset Policy

`live-loop` is intended to be a free, local-first, open-source AI instrument.

The core idea is simple:

```text
Free to use, hack, learn from, and perform with.
If it becomes useful in your music, performances, teaching, or research,
please support ongoing development voluntarily.
```

## Project position

This project is not meant to be a closed SaaS or a paywalled preset pack.

It is a local AI live-loop instrument where:

- the performer keeps control;
- voice/text commands express musical intent;
- AI interprets intent into safe declarative music data;
- Tone.js performs only validated PatternDSL/MusicPlan changes;
- the system remains hackable and inspectable.

## License split

Current policy:

- Code: MIT License, see `LICENSE`.
- Documentation: MIT unless a file says otherwise.
- Bundled samples/presets: only permissive assets should be committed, with license notes close to the files.
- AI models: not covered by this repository license. Models keep their own upstream licenses.
- User-provided samples/models: the user is responsible for having the right to use them.

## Dependency and asset caution

Open-source code dependencies do not automatically make every model, sample, or preset freely redistributable.

Before bundling anything, check the license for:

- STT models, including faster-whisper model repos;
- local LLM GGUF weights;
- MusicGen/AudioCraft or other generation models if added later;
- drum one-shots, loops, impulse responses, and sample packs;
- Butterchurn/MilkDrop visual presets;
- community-contributed patch packs.

Safer default:

- keep large models out of git;
- provide downloader/setup instructions instead of bundling restricted models;
- include only self-made or clearly permissive samples;
- keep a small license note beside each bundled asset folder.

## Donation/support model

Core features should remain free and open.

Suggested support channels later:

- GitHub Sponsors;
- Ko-fi / Buy Me a Coffee;
- Open Collective;
- optional workshops, setup help, artist packs, or custom performance support.

Good support message:

```text
This instrument is free because musical tools should be hackable, local, and accessible.
If live-loop helps your music, performance, teaching, or research, please consider sponsoring development.
Your support funds testing, documentation, model integration, and new live-performance features.
```

## What should not be paywalled

Avoid locking these behind payment:

- core audio engine;
- local-first STT/LLM integration boundaries;
- PatternDSL/MusicPlan validation;
- basic role agents and musical intent engine;
- safety controls such as stop, panic, undo, and quantized scheduling.

Paid or sponsor-supported work should be additive, not coercive:

- installation help;
- workshops;
- custom performance setups;
- optional curated packs with clean licenses;
- development logs or roadmap voting;
- commissioned integrations.

## README identity statement

Use this framing consistently:

```text
live-loop is a free, open-source, local-first AI performance instrument.
It is not an AI song generator and not a DAW replacement.
It is a voice-directed live ensemble: AI translates intention, while the runtime performs only validated musical plans at safe timing boundaries.
```
