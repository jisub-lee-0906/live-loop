from __future__ import annotations

import typer
from rich.console import Console

from .actions import parse_fast_command
from .osc_client import SonicPiClient

app = typer.Typer(help="Voice/text loop-station conductor for Sonic Pi.")
console = Console()


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
