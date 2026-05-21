# Portable Sonic Pi Runtime Plan

Goal: make `live-loop` usable as a portable bundle, while keeping the first prototype debuggable.

## Key decision

Sonic Pi should be treated as an embedded external runtime, not as a Python dependency.

Reason:
- Sonic Pi is a full desktop app/runtime, not a small library.
- It owns its own audio server, synth engine, Ruby runtime, GUI/runtime process, and OSC server.
- The Python side should not import Sonic Pi; it should launch/detect it and communicate via OSC.

## Repository layout

```text
live-loop/
  src/live_loop/              # Python conductor
  sonic_pi/main.rb            # Sonic Pi live_loop runtime script
  runtime/
    sonic-pi/                 # ignored: local portable Sonic Pi app/runtime
    cache/                    # ignored: downloaded installers/archives
  scripts/
    download_sonic_pi.ps1     # Windows download helper, later
    launch_sonic_pi.ps1       # launch bundled Sonic Pi, later
  docs/
    portable-runtime-plan.md
```

`runtime/sonic-pi/` should stay out of git. We can provide scripts that populate it.

## Development order

### Phase A: external installed Sonic Pi

Use the normal Windows Sonic Pi install first.

Acceptance:
- Sonic Pi runs manually.
- `sonic_pi/main.rb` receives OSC from Python.
- `uv run live-loop send "킥 깔아줘"` changes sound.

This proves the musical/control architecture before we fight packaging.

### Phase B: portable runtime folder

Add a downloader/installer helper that places Sonic Pi under:

```text
runtime/sonic-pi/
```

Possible strategies:
1. If an official portable zip/AppImage exists for the target OS, download and unpack it.
2. If Windows only provides an installer, download to `runtime/cache/` and document/extract/install into `runtime/sonic-pi/`.
3. If no reliable portable distribution exists, keep a user-provided local Sonic Pi path in config and package only our Python side.

Do not commit the Sonic Pi binary/runtime into git.

### Phase C: launcher integration

Add `live-loop doctor`:
- checks Python dependencies
- checks Sonic Pi path
- checks OSC port reachability where possible
- prints exact next step

Add `live-loop launch-sonic-pi` or Windows PowerShell launcher:
- starts bundled Sonic Pi if present
- otherwise prints install/download instruction

### Phase D: one-command session

Target command:

```bash
uv run live-loop session
```

It should eventually:
- start/verify Sonic Pi
- tell the user to run or auto-load `sonic_pi/main.rb` if possible
- open text REPL
- later enable push-to-talk STT

## Important constraints

- Keep the OSC protocol stable so portable packaging does not affect music logic.
- Do not block Phase A on perfect packaging.
- Prefer explicit local paths and diagnostics over hidden magic.
- Generated/downloaded runtime files must be gitignored.
