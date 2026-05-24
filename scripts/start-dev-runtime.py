#!/usr/bin/env python3
"""Start and verify the live-loop development runtime.

This is a productization bridge before desktop packaging: one command checks the
backend/frontend ports, starts missing dev servers, verifies health endpoints,
and optionally prewarms local LLM/STT paths.
"""

from __future__ import annotations

import argparse
import contextlib
import http.client
import json
import os
import signal
import socket
import subprocess
import sys
import tempfile
import time
import wave
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
BACKEND_PORT = 8101
FRONTEND_PORT = 5173
BACKEND_URL = f"http://127.0.0.1:{BACKEND_PORT}"
FRONTEND_URL = f"http://127.0.0.1:{FRONTEND_PORT}"


@dataclass
class ManagedProcess:
    name: str
    process: subprocess.Popen[str]


def port_open(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.3)
        return sock.connect_ex((host, port)) == 0


def request_json(path: str, *, method: str = "GET", body: bytes | None = None, headers: dict[str, str] | None = None, timeout: float = 5.0) -> tuple[int, object]:
    conn = http.client.HTTPConnection("127.0.0.1", BACKEND_PORT, timeout=timeout)
    try:
        conn.request(method, path, body=body, headers=headers or {})
        response = conn.getresponse()
        payload = response.read().decode("utf-8", errors="replace")
        try:
            parsed: object = json.loads(payload)
        except json.JSONDecodeError:
            parsed = payload
        return response.status, parsed
    finally:
        conn.close()


def request_frontend_head(timeout: float = 5.0) -> int:
    conn = http.client.HTTPConnection("127.0.0.1", FRONTEND_PORT, timeout=timeout)
    try:
        conn.request("HEAD", "/")
        response = conn.getresponse()
        response.read()
        return response.status
    finally:
        conn.close()


def wait_for(label: str, probe, timeout_s: float = 45.0, interval_s: float = 0.5):
    deadline = time.time() + timeout_s
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            result = probe()
            if result:
                print(f"[ready] {label}")
                return result
        except Exception as exc:  # noqa: BLE001 - report last startup failure.
            last_error = exc
        time.sleep(interval_s)
    if last_error:
        raise RuntimeError(f"{label} did not become ready: {last_error}")
    raise RuntimeError(f"{label} did not become ready")


def start_backend() -> ManagedProcess | None:
    if port_open(BACKEND_PORT):
        print(f"[reuse] backend already listening on {BACKEND_URL}")
        return None
    print("[start] backend: uv run live-loop-api")
    process = subprocess.Popen(
        ["uv", "run", "live-loop-api"],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    return ManagedProcess("backend", process)


def start_frontend() -> ManagedProcess | None:
    if port_open(FRONTEND_PORT, host="127.0.0.1"):
        print(f"[reuse] frontend already listening on {FRONTEND_URL}")
        return None
    env = os.environ.copy()
    env.setdefault("VITE_LIVE_LOOP_ENABLE_TEXT_INPUT", "1")
    env.setdefault("VITE_LIVE_LOOP_USE_BACKEND_COMMANDS", "1")
    env.setdefault("VITE_LIVE_LOOP_USE_LOCAL_LLM", "1")
    env.setdefault("VITE_LIVE_LOOP_STT_TIMEOUT_MS", "60000")
    env.setdefault("VITE_LIVE_LOOP_BACKEND_TIMEOUT_MS", "1200")
    env.setdefault("VITE_LIVE_LOOP_LLM_TIMEOUT_MS", "6000")
    print("[start] frontend: npm run dev -- --host 0.0.0.0")
    process = subprocess.Popen(
        ["npm", "run", "dev", "--", "--host", "0.0.0.0"],
        cwd=FRONTEND,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    return ManagedProcess("frontend", process)


def health_summary() -> None:
    for label, path in [
        ("backend health", "/api/health"),
        ("stt status", "/api/stt/status"),
        ("model status", "/api/model/status"),
    ]:
        status, payload = request_json(path)
        print(f"[probe] {label}: HTTP {status} {json.dumps(payload, ensure_ascii=False)}")
    frontend_status = request_frontend_head()
    print(f"[probe] frontend: HTTP {frontend_status} {FRONTEND_URL}/")


def prewarm_llm() -> None:
    prompt = urlencode({"prompt": "킥 깔아줘"})
    status, payload = request_json(f"/api/llm/prewarm?{prompt}", method="POST", timeout=90)
    print(f"[prewarm] llm: HTTP {status} {json.dumps(payload, ensure_ascii=False)}")


def build_warmup_wav(path: Path) -> None:
    import math
    import struct

    rate = 16_000
    seconds = 0.8
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        for i in range(int(rate * seconds)):
            sample = int(1200 * math.sin(2 * math.pi * 440 * i / rate))
            handle.writeframes(struct.pack("<h", sample))


def prewarm_stt() -> None:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp:
        wav_path = Path(temp.name)
    try:
        build_warmup_wav(wav_path)
        data = wav_path.read_bytes()
        boundary = "live-loop-boundary"
        body = (
            f"--{boundary}\r\n"
            'Content-Disposition: form-data; name="file"; filename="warmup.wav"\r\n'
            "Content-Type: audio/wav\r\n\r\n"
        ).encode("utf-8") + data + f"\r\n--{boundary}--\r\n".encode("utf-8")
        status, payload = request_json(
            "/api/stt/transcribe?language=ko",
            method="POST",
            body=body,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            timeout=90,
        )
        print(f"[prewarm] stt: HTTP {status} {json.dumps(payload, ensure_ascii=False)}")
    finally:
        with contextlib.suppress(FileNotFoundError):
            wav_path.unlink()


def stop_processes(processes: list[ManagedProcess]) -> None:
    for managed in processes:
        if managed.process.poll() is None:
            print(f"[stop] {managed.name}")
            with contextlib.suppress(ProcessLookupError):
                os.killpg(managed.process.pid, signal.SIGTERM)
    deadline = time.time() + 5
    for managed in processes:
        while managed.process.poll() is None and time.time() < deadline:
            time.sleep(0.1)
        if managed.process.poll() is None:
            with contextlib.suppress(ProcessLookupError):
                os.killpg(managed.process.pid, signal.SIGKILL)


def main() -> int:
    parser = argparse.ArgumentParser(description="Start and verify live-loop dev runtime")
    parser.add_argument("--check-only", action="store_true", help="Do not start missing servers; only verify readiness")
    parser.add_argument("--prewarm", action="store_true", help="Prewarm LLM and STT after health checks")
    parser.add_argument("--no-wait", action="store_true", help="Exit after readiness instead of keeping started processes attached")
    args = parser.parse_args()

    processes: list[ManagedProcess] = []
    try:
        if args.check_only:
            if not port_open(BACKEND_PORT):
                raise RuntimeError(f"backend is not listening on {BACKEND_URL}")
            if not port_open(FRONTEND_PORT):
                raise RuntimeError(f"frontend is not listening on {FRONTEND_URL}")
        else:
            for managed in [start_backend(), start_frontend()]:
                if managed:
                    processes.append(managed)

        wait_for("backend /api/health", lambda: request_json("/api/health")[0] == 200, timeout_s=60)
        wait_for("frontend /", lambda: request_frontend_head() in {200, 304}, timeout_s=60)
        health_summary()

        if args.prewarm:
            prewarm_llm()
            prewarm_stt()

        print("\n[ready] live-loop development runtime")
        print(f"Frontend: {FRONTEND_URL}/")
        print(f"Backend:  {BACKEND_URL}")
        print("QA:       docs/qa/golden-performance-flow.md")

        if args.no_wait or args.check_only or not processes:
            return 0

        print("\nPress Ctrl+C to stop processes started by this launcher.")
        while True:
            for managed in processes:
                if managed.process.poll() is not None:
                    raise RuntimeError(f"{managed.name} exited with code {managed.process.returncode}")
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[interrupt] stopping runtime")
        return 130
    except Exception as exc:  # noqa: BLE001 - CLI should print actionable error.
        print(f"[error] {exc}", file=sys.stderr)
        return 1
    finally:
        stop_processes(processes)


if __name__ == "__main__":
    raise SystemExit(main())
