from __future__ import annotations

import json
import re
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, field_validator

Style = Literal["house", "uk_garage", "techno", "ambient"]
Target = Literal["drums", "bass", "pad", "lead", "texture", "fx", "mix"]
Timing = Literal["now", "next_step", "next_bar"]

KNOWN_CONSTRAINTS = {
    "shuffle_hats",
    "offbeat_bass",
    "four_on_floor",
    "tight_kick",
    "ghost_snare",
    "wide_pad",
    "sparkle_arp",
    "vinyl_air",
    "riser_sweep",
    "drop_impact",
    "delay_throw",
    "stutter_gate",
    "minimal",
    "busy",
}


class LiveCodeIntent(BaseModel):
    style: Style = "house"
    targets: list[Target] = Field(default_factory=lambda: ["drums", "bass"])
    constraints: list[str] = Field(default_factory=list)
    timing: Timing = "next_bar"
    confidence: float = Field(default=0.7, ge=0.0, le=1.0)

    @field_validator("constraints")
    @classmethod
    def normalize_constraints(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        for value in values:
            key = value.strip().lower().replace(" ", "_").replace("-", "_")
            if key in KNOWN_CONSTRAINTS and key not in normalized:
                normalized.append(key)
        return normalized


def compose_rule_intent(text: str) -> LiveCodeIntent:
    lower = text.lower()
    style: Style = "uk_garage" if any(token in lower for token in ["garage", "개러지", "uk", "셔플", "shuffle"]) else "house"
    constraints: list[str] = []
    if style == "uk_garage":
        constraints.extend(["shuffle_hats", "offbeat_bass"])
    else:
        constraints.extend(["four_on_floor", "tight_kick"])
    if any(token in lower for token in ["베이스", "bass", "오프비트", "통통"]):
        constraints.append("offbeat_bass")
    if any(token in lower for token in ["패드", "pad", "공간", "몽환"]):
        constraints.append("wide_pad")
    if any(token in lower for token in ["리드", "멜로디", "아르페지오", "반짝", "lead", "arp", "sparkle"]):
        constraints.append("sparkle_arp")
    if any(token in lower for token in ["텍스처", "질감", "공기", "노이즈", "texture", "atmosphere", "vinyl"]):
        constraints.append("vinyl_air")
    if any(token in lower for token in ["임팩트", "impact", "쾅"]):
        constraints.append("drop_impact")
    if any(token in lower for token in ["딜레이", "delay", "던져", "throw"]):
        constraints.append("delay_throw")
    if any(token in lower for token in ["스터터", "stutter", "게이트", "gate", "잘라"]):
        constraints.append("stutter_gate")
    if any(token in lower for token in ["fx", "효과", "전환", "빌드업", "라이저", "riser", "스윕", "sweep"]):
        constraints.append("riser_sweep")
    if any(token in lower for token in ["쪼개", "busy", "복잡", "몰아"]):
        constraints.append("busy")
    targets: list[Target] = ["drums", "bass"]
    if "wide_pad" in constraints:
        targets.append("pad")
    if "sparkle_arp" in constraints:
        targets.append("lead")
    if "vinyl_air" in constraints:
        targets.append("texture")
    if any(item in constraints for item in ["riser_sweep", "drop_impact", "delay_throw", "stutter_gate"]):
        targets.append("fx")
    return LiveCodeIntent(style=style, targets=targets, constraints=constraints, timing="next_bar", confidence=0.72)


def _json_fragment(raw: str) -> dict[str, object] | None:
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end < start:
        return None
    try:
        loaded = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError:
        return None
    return loaded if isinstance(loaded, dict) else None


def _from_freeform_intent(data: dict[str, object], fallback_text: str) -> LiveCodeIntent:
    text = " ".join(str(data.get(key, "")) for key in ["style", "intent", "command", "description"]) or fallback_text
    return compose_rule_intent(text)


def parse_model_intent(raw: str, fallback_text: str) -> LiveCodeIntent:
    data = _json_fragment(raw)
    if data is None:
        return compose_rule_intent(fallback_text)
    if not any(key in data for key in ["style", "targets", "constraints", "timing", "confidence"]):
        return _from_freeform_intent(data, fallback_text)
    try:
        return LiveCodeIntent.model_validate(data)
    except ValidationError:
        return _from_freeform_intent(data, fallback_text)
