from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class Intent(StrEnum):
    ADD_LAYER = "add_layer"
    MODIFY_LAYER = "modify_layer"
    MUTE_LAYER = "mute_layer"
    UNMUTE_LAYER = "unmute_layer"
    PANIC = "panic"


LayerType = Literal["kick", "snare", "hats", "bass", "pad", "lead", "texture", "fx", "drums"]


class MusicAction(BaseModel):
    intent: Intent
    target: LayerType
    value: float = Field(default=1.0, ge=0.0, le=1.0)
    delta: float = Field(default=0.0, ge=-1.0, le=1.0)
    timing: Literal["now", "next_bar"] = "next_bar"


def parse_fast_command(text: str) -> MusicAction | None:
    """Tiny deterministic parser for the first prototype.

    This intentionally handles only obvious commands. Later, ambiguous Korean
    commands should go through an LLM that emits the same MusicAction schema.
    """
    t = text.strip().lower()
    if not t:
        return None

    if t in {"panic", "stop", "all stop", "정지", "멈춰"}:
        return MusicAction(intent=Intent.PANIC, target="drums", timing="now")

    if any(word in t for word in ["드럼", "비트", "리듬", "beat", "drum", "groove"]):
        if any(word in t for word in ["mute", "off", "빼", "꺼", "뮤트"]):
            return MusicAction(intent=Intent.MUTE_LAYER, target="drums")
        if any(word in t for word in ["unmute", "on", "켜", "다시"]):
            return MusicAction(intent=Intent.UNMUTE_LAYER, target="drums")

    if any(word in t for word in ["kick", "킥"]):
        return MusicAction(intent=Intent.ADD_LAYER, target="kick")
    if any(word in t for word in ["snare", "clap", "스네어", "클랩"]):
        return MusicAction(intent=Intent.ADD_LAYER, target="snare")
    if any(word in t for word in ["hat", "hihat", "hi-hat", "하이햇", "햇"]):
        if any(word in t for word in ["less", "줄", "덜", "빼"]):
            return MusicAction(intent=Intent.MODIFY_LAYER, target="hats", delta=-0.25)
        return MusicAction(intent=Intent.ADD_LAYER, target="hats", value=0.6)
    if any(word in t for word in ["bass", "베이스"]):
        if any(word in t for word in ["mute", "off", "빼", "꺼"]):
            return MusicAction(intent=Intent.MUTE_LAYER, target="bass")
        if any(word in t for word in ["unmute", "on", "켜", "다시"]):
            return MusicAction(intent=Intent.UNMUTE_LAYER, target="bass")
        return MusicAction(intent=Intent.ADD_LAYER, target="bass", value=0.55)
    if any(word in t for word in ["lead", "arp", "sparkle", "리드", "멜로디", "아르페지오", "반짝"]):
        if any(word in t for word in ["mute", "off", "빼", "꺼"]):
            return MusicAction(intent=Intent.MUTE_LAYER, target="lead")
        return MusicAction(intent=Intent.ADD_LAYER, target="lead", value=0.36)
    if any(word in t for word in ["texture", "atmosphere", "vinyl", "텍스처", "질감", "공기", "노이즈"]):
        if any(word in t for word in ["mute", "off", "빼", "꺼"]):
            return MusicAction(intent=Intent.MUTE_LAYER, target="texture")
        return MusicAction(intent=Intent.ADD_LAYER, target="texture", value=0.3)
    fx_words = [
        "fx",
        "effect",
        "riser",
        "sweep",
        "impact",
        "drop",
        "delay",
        "throw",
        "stutter",
        "gate",
        "효과",
        "전환",
        "빌드업",
        "드랍",
        "라이저",
        "스윕",
        "임팩트",
        "쾅",
        "딜레이",
        "던져",
        "스터터",
        "게이트",
        "잘라",
    ]
    if any(word in t for word in fx_words):
        if any(word in t for word in ["mute", "off", "빼", "꺼"]):
            return MusicAction(intent=Intent.MUTE_LAYER, target="fx")
        return MusicAction(intent=Intent.ADD_LAYER, target="fx", value=0.42)

    if any(word in t for word in ["쪼개", "잘게", "복잡", "complex", "busier", "busy"]):
        return MusicAction(intent=Intent.MODIFY_LAYER, target="drums", delta=0.25)
    if any(word in t for word in ["단순", "simple", "less", "덜어"]):
        return MusicAction(intent=Intent.MODIFY_LAYER, target="drums", delta=-0.25)

    return None
