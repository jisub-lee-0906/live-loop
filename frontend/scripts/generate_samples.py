#!/usr/bin/env python3
"""Generate small repo-safe drum one-shots for the live-loop prototype."""

from __future__ import annotations

import math
import os
import random
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public" / "samples" / "drums"
SAMPLE_RATE = 44_100


def clamp(value: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def soft_clip(x: float, drive: float = 1.8) -> float:
    return math.tanh(x * drive) / math.tanh(drive)


def write_wav(path: Path, samples: list[float]) -> None:
    peak = max(max(abs(s) for s in samples), 1e-6)
    normalized = [clamp(s / peak * 0.92) for s in samples]
    with wave.open(str(path), "w") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(b"".join(struct.pack("<h", int(s * 32767)) for s in normalized))


def kick() -> list[float]:
    length = int(SAMPLE_RATE * 0.72)
    phase = 0.0
    out: list[float] = []
    for i in range(length):
        t = i / SAMPLE_RATE
        body_env = math.exp(-t * 8.8)
        sub_env = math.exp(-t * 5.4)
        click_env = math.exp(-t * 250)
        freq = 42 + 116 * math.exp(-t * 35)
        phase += 2 * math.pi * freq / SAMPLE_RATE
        body = math.sin(phase) * body_env * 1.15
        sub = math.sin(2 * math.pi * 43 * t) * sub_env * 0.45
        click = (random.random() * 2 - 1) * click_env * 0.32
        out.append(soft_clip(body + sub + click, 2.3))
    return out


def snare() -> list[float]:
    length = int(SAMPLE_RATE * 0.42)
    out: list[float] = []
    lowpass = 0.0
    for i in range(length):
        t = i / SAMPLE_RATE
        noise_env = math.exp(-t * 17)
        tone_env = math.exp(-t * 10)
        raw = random.random() * 2 - 1
        lowpass = lowpass * 0.62 + raw * 0.38
        crack = (raw - lowpass * 0.45) * noise_env * 0.9
        tone = math.sin(2 * math.pi * 185 * t) * tone_env * 0.45
        snap = (random.random() * 2 - 1) * math.exp(-t * 115) * 0.45
        out.append(soft_clip(crack + tone + snap, 1.7))
    return out


def hat() -> list[float]:
    length = int(SAMPLE_RATE * 0.16)
    out: list[float] = []
    hp = 0.0
    last = 0.0
    for i in range(length):
        t = i / SAMPLE_RATE
        env = math.exp(-t * 48)
        raw = random.random() * 2 - 1
        hp = 0.72 * (hp + raw - last)
        last = raw
        metallic = math.sin(2 * math.pi * 7230 * t) * 0.17 + math.sin(2 * math.pi * 9310 * t) * 0.11
        out.append(soft_clip((hp + metallic) * env, 1.4))
    return out


def main() -> None:
    random.seed(42)
    os.makedirs(ROOT, exist_ok=True)
    write_wav(ROOT / "kick_01.wav", kick())
    write_wav(ROOT / "snare_01.wav", snare())
    write_wav(ROOT / "hat_closed_01.wav", hat())
    for path in sorted(ROOT.glob("*.wav")):
        print(path, path.stat().st_size)


if __name__ == "__main__":
    main()
