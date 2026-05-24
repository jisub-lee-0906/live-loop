from __future__ import annotations

import json as jsonlib

import typer
from rich.console import Console
from rich.table import Table

from .actions import parse_fast_command
from .local_llm import benchmark_intent_latency, get_local_model_status
from .local_stt import get_local_stt_status
from .osc_client import SonicPiClient

app = typer.Typer(help="Voice/text loop-station conductor for Sonic Pi.")
console = Console()


@app.command()
def doctor(json_output: bool = typer.Option(False, "--json", help="Print machine-readable JSON status.")) -> None:
    """Check local runtime readiness for the live-loop performance stack."""
    stt = get_local_stt_status()
    llm = get_local_model_status()
    payload = {
        "ok": bool(stt.ready and llm.ready),
        "stt": {
            "mode": stt.mode,
            "model_name": stt.model_name,
            "language": stt.language,
            "device": stt.device,
            "compute_type": stt.compute_type,
            "runtime_available": stt.runtime_available,
            "ready": stt.ready,
        },
        "llm": {
            "mode": llm.mode,
            "model_path": llm.model_path,
            "exists": llm.exists,
            "runtime": llm.runtime,
            "ready": llm.ready,
            "message": llm.message,
        },
    }
    if json_output:
        typer.echo(jsonlib.dumps(payload, ensure_ascii=False, indent=2))
        return

    console.print("live-loop doctor")
    table = Table(show_header=True, header_style="bold")
    table.add_column("Component")
    table.add_column("Ready")
    table.add_column("Runtime")
    table.add_column("Details")
    table.add_row(
        "STT",
        "yes" if stt.ready else "no",
        stt.mode,
        f"model={stt.model_name}, language={stt.language}, device={stt.device}, compute={stt.compute_type}",
    )
    table.add_row(
        "LLM",
        "yes" if llm.ready else "no",
        llm.mode,
        f"runtime={llm.runtime}, model={llm.model_path}, message={llm.message}",
    )
    console.print(table)
    typer.echo(f"LLM model path: {llm.model_path}")


@app.command("benchmark-llm")
def benchmark_llm(
    prompts: list[str] | None = typer.Option(None, "--prompt", help="Prompt to benchmark. Can be repeated."),
    json_output: bool = typer.Option(False, "--json", help="Print machine-readable JSON report."),
) -> None:
    """Measure local GGUF intent latency for cold/warm command planning."""
    report = benchmark_intent_latency(prompts=prompts)
    if json_output:
        typer.echo(jsonlib.dumps(report.to_dict(), ensure_ascii=False, indent=2))
        return

    console.print("live-loop LLM latency benchmark")
    console.print(f"ready: {'yes' if report.ready else 'no'}")
    console.print(f"model: {report.model_path}")
    if not report.ready:
        console.print("LLM is not ready; run `uv run live-loop doctor` for details.")
        return

    table = Table(show_header=True, header_style="bold")
    table.add_column("Prompt")
    table.add_column("Latency")
    table.add_column("OK")
    table.add_column("Error")
    for sample in report.samples:
        table.add_row(sample.prompt, f"{sample.latency_ms}ms", "yes" if sample.ok else "no", sample.error or "")
    console.print(table)
    console.print(f"cold: {report.cold_latency_ms}ms")
    console.print(f"warm p50: {report.warm_p50_latency_ms}ms")
    console.print(f"max: {report.max_latency_ms}ms")
    console.print(f"recommended frontend timeout: {report.recommended_frontend_timeout_ms}ms")


@app.command()
def send(
    command: str = typer.Argument(..., help="Command text, e.g. 'kick' or '드럼 더 쪼개줘'"),
    host: str = typer.Option("127.0.0.1", help="Sonic Pi OSC host"),
    port: int = typer.Option(4560, help="Sonic Pi external OSC UDP port"),
) -> None:
    action = parse_fast_command(command)
    if action is None:
        raise typer.BadParameter(f"Unsupported command for fast parser: {command!r}")
    SonicPiClient(host=host, port=port).send_action(action)
    console.print(action.model_dump_json(indent=2))


@app.command()
def repl(
    host: str = typer.Option("127.0.0.1", help="Sonic Pi OSC host"),
    port: int = typer.Option(4560, help="Sonic Pi external OSC UDP port"),
) -> None:
    client = SonicPiClient(host=host, port=port)
    console.print("live-loop text REPL. Try: kick, hats, bass, 드럼 더 쪼개줘, panic")
    while True:
        try:
            command = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            console.print("\nbye")
            return
        if command in {"quit", "exit"}:
            return
        action = parse_fast_command(command)
        if action is None:
            console.print(f"[yellow]unsupported:[/yellow] {command}")
            continue
        client.send_action(action)
        console.print(action.model_dump())
