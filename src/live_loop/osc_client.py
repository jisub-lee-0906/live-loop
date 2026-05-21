from __future__ import annotations

from pythonosc.udp_client import SimpleUDPClient

from .actions import Intent, MusicAction


class SonicPiClient:
    def __init__(self, host: str = "127.0.0.1", port: int = 4560) -> None:
        # Sonic Pi listens for external OSC on UDP 4560 by default.
        self.client = SimpleUDPClient(host, port)

    def send_action(self, action: MusicAction) -> None:
        base = "/live_loop"
        self.client.send_message(f"{base}/intent", action.intent.value)
        self.client.send_message(f"{base}/target", action.target)
        self.client.send_message(f"{base}/value", float(action.value))
        self.client.send_message(f"{base}/delta", float(action.delta))
        self.client.send_message(f"{base}/timing", action.timing)

        # Also send direct convenience addresses for the Sonic Pi MVP script.
        if action.intent is Intent.ADD_LAYER:
            self.client.send_message(f"/live_loop/layer/{action.target}/enabled", 1)
            self.client.send_message(f"/live_loop/layer/{action.target}/value", float(action.value))
        elif action.intent is Intent.MODIFY_LAYER:
            self.client.send_message(f"/live_loop/layer/{action.target}/delta", float(action.delta))
        elif action.intent is Intent.MUTE_LAYER:
            self.client.send_message(f"/live_loop/layer/{action.target}/enabled", 0)
        elif action.intent is Intent.UNMUTE_LAYER:
            self.client.send_message(f"/live_loop/layer/{action.target}/enabled", 1)
        elif action.intent is Intent.PANIC:
            self.client.send_message("/live_loop/panic", 1)
