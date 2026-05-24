from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from .tone_knowledge import search_tone_knowledge

PlanTiming = Literal["now", "next_bar", "next_phrase"]
PlanTarget = Literal["kick", "snare", "hats", "bass", "pad", "lead", "texture", "fx", "mix"]
PlanOperationType = Literal["set_enabled", "set_volume", "set_complexity", "set_macro", "set_pattern_events", "preserve_layer"]
FxShapeType = Literal["riser", "impact", "delay_throw", "tension_cut", "air_wash"]
CurveShape = Literal["linear", "exponential", "rising", "falling", "pulse"]


class PatternEvent(BaseModel):
    step: int = Field(ge=0, le=15)
    voice: Literal["kick", "snare", "hat", "bass", "pad", "lead", "texture", "fx"]
    velocity: float = Field(ge=0.0, le=1.0)
    length: str | None = None
    note: str | None = None


class AutomationCurve(BaseModel):
    parameter: Literal["filterCutoff", "reverbWet", "delayWet", "volume", "gate"]
    start_step: int = Field(ge=0, le=15)
    end_step: int = Field(ge=0, le=16)
    start_value: float
    end_value: float
    shape: CurveShape = "linear"

    @field_validator("end_step")
    @classmethod
    def end_step_after_start(cls, value: int, info: Any) -> int:
        start_step = info.data.get("start_step")
        if isinstance(start_step, int) and value <= start_step:
            raise ValueError("end_step must be greater than start_step")
        return value


class FxShape(BaseModel):
    type: FxShapeType
    start_step: int = Field(ge=0, le=15)
    end_step: int = Field(ge=1, le=16)
    intensity: float = Field(ge=0.0, le=1.0)
    density: float = Field(ge=0.0, le=1.0)
    curves: list[AutomationCurve] = Field(default_factory=list)


class MusicPlanOperation(BaseModel):
    type: PlanOperationType
    name: str | None = None
    value: bool | int | float | str | list[dict[str, Any]] | None = None


class MusicPlanPatch(BaseModel):
    target: PlanTarget
    reason: str
    operations: list[MusicPlanOperation] = Field(default_factory=list)
    pattern_events: list[PatternEvent] = Field(default_factory=list)
    automation: list[AutomationCurve] = Field(default_factory=list)
    shape: FxShape | None = None


class ArrangementPlan(BaseModel):
    intent: Literal["arrange", "transition", "modify", "mute", "panic"] = "arrange"
    timing: PlanTiming = "next_bar"
    summary: str
    preserve: list[PlanTarget] = Field(default_factory=list)
    patches: list[MusicPlanPatch] = Field(default_factory=list)
    knowledge_entry_ids: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.68, ge=0.0, le=1.0)

    @field_validator("preserve")
    @classmethod
    def dedupe_preserve(cls, values: list[PlanTarget]) -> list[PlanTarget]:
        return list(dict.fromkeys(values))


def _has_any(text: str, words: list[str]) -> bool:
    return any(word in text for word in words)


def _fx_plan_from_text(text: str) -> tuple[FxShape, list[PatternEvent], list[AutomationCurve], dict[str, float]]:
    """Generate parameterized FX data instead of selecting a named gesture preset.

    Fixed catalog patches can still exist as low-level fallbacks, but this rule
    planner proves the trunk shape we want the LLM to emit: safe numeric macros,
    generated PatternDSL events, and automation curves derived from intent words.
    """
    if _has_any(text, ["스터터", "게이트", "잘라", "숨", "stutter", "gate", "cut"]):
        start = 10 if _has_any(text, ["숨", "긴장", "참"]) else 12
        steps = list(range(start, 16))
        curves = [
            AutomationCurve(parameter="gate", start_step=start, end_step=16, start_value=0.35, end_value=0.86, shape="rising"),
            AutomationCurve(parameter="filterCutoff", start_step=start, end_step=16, start_value=1800, end_value=7600, shape="rising"),
        ]
        shape = FxShape(type="tension_cut", start_step=start, end_step=16, intensity=0.74, density=0.82, curves=curves)
        events = [PatternEvent(step=step, voice="fx", velocity=round(0.18 + index * 0.08, 2), length="16n") for index, step in enumerate(steps)]
        macros = {"filterCutoff": 7600, "reverbWet": 0.28, "delayWet": 0.26, "release": 0.16}
        return shape, events, curves, macros

    if _has_any(text, ["드랍", "쾅", "impact", "drop"]):
        curves = [
            AutomationCurve(parameter="filterCutoff", start_step=15, end_step=16, start_value=1800, end_value=2400, shape="falling"),
            AutomationCurve(parameter="reverbWet", start_step=15, end_step=16, start_value=0.42, end_value=0.62, shape="pulse"),
        ]
        shape = FxShape(type="impact", start_step=15, end_step=16, intensity=0.78, density=0.22, curves=curves)
        events = [PatternEvent(step=15, voice="fx", velocity=0.58, length="16n"), PatternEvent(step=0, voice="fx", velocity=0.72, length="4n")]
        macros = {"filterCutoff": 2400, "reverbWet": 0.58, "delayWet": 0.08, "release": 2.2}
        return shape, events, curves, macros

    if _has_any(text, ["딜레이", "던져", "delay", "throw", "남겨"]):
        curves = [
            AutomationCurve(parameter="delayWet", start_step=12, end_step=16, start_value=0.12, end_value=0.58, shape="rising"),
            AutomationCurve(parameter="filterCutoff", start_step=12, end_step=16, start_value=3600, end_value=7200, shape="linear"),
        ]
        shape = FxShape(type="delay_throw", start_step=12, end_step=16, intensity=0.62, density=0.42, curves=curves)
        events = [PatternEvent(step=14, voice="fx", velocity=0.28, length="16n"), PatternEvent(step=15, voice="fx", velocity=0.42, length="16n")]
        macros = {"filterCutoff": 6800, "reverbWet": 0.36, "delayWet": 0.52, "release": 0.72}
        return shape, events, curves, macros

    curves = [
        AutomationCurve(parameter="filterCutoff", start_step=8, end_step=16, start_value=1800, end_value=9200, shape="rising"),
        AutomationCurve(parameter="reverbWet", start_step=8, end_step=16, start_value=0.2, end_value=0.5, shape="linear"),
    ]
    shape = FxShape(type="riser", start_step=8, end_step=16, intensity=0.58, density=0.35, curves=curves)
    events = [PatternEvent(step=12, voice="fx", velocity=0.24, length="16n"), PatternEvent(step=15, voice="fx", velocity=0.48, length="16n")]
    macros = {"filterCutoff": 9200, "reverbWet": 0.5, "delayWet": 0.22, "release": 1.2}
    return shape, events, curves, macros


def compose_rule_arrangement_plan(text: str, loop_state: dict[str, Any] | None = None) -> ArrangementPlan:
    """Small fallback planner for the retrieval-first ArrangementPlan path.

    This is intentionally not the destination LLM planner. It keeps the app usable
    when the local model is missing while proving the contract: natural text plus
    LoopState context returns a validated, declarative, parameterized music plan;
    it never emits raw Tone.js/JS and avoids reducing ambiguous FX language to a
    single hardcoded gesture preset.
    """
    lower = text.lower()
    knowledge = search_tone_knowledge(text, limit=3)
    knowledge_ids = [result.entry.id for result in knowledge]
    preserve: list[PlanTarget] = []
    if "베이스" in lower or "bass" in lower or "유지" in lower:
        preserve.append("bass")
    if "킥" in lower or "kick" in lower or "유지" in lower:
        preserve.append("kick")

    fx_words = ["전환", "빌드업", "드랍", "긴장", "터질", "라이저", "딜레이", "스터터", "게이트", "숨", "impact", "riser", "delay", "stutter", "drop"]
    space_words = ["공간", "넓", "몽환", "공기", "질감", "space", "wide", "air", "atmosphere"]
    busy_words = ["몰아", "쪼개", "복잡", "바쁘", "busy", "drive"]

    patches: list[MusicPlanPatch] = []
    timing: PlanTiming = "next_bar"
    intent: Literal["arrange", "transition", "modify", "mute", "panic"] = "arrange"

    if any(word in lower for word in fx_words):
        intent = "transition"
        timing = "next_phrase"
        shape, events, curves, macros = _fx_plan_from_text(lower)
        patches.append(
            MusicPlanPatch(
                target="fx",
                reason="natural transition request generated as safe FX shape, PatternDSL events, and automation curves",
                operations=[
                    MusicPlanOperation(type="set_enabled", value=True),
                    MusicPlanOperation(type="set_volume", value=round(0.26 + shape.intensity * 0.28, 2)),
                    MusicPlanOperation(type="set_complexity", value=shape.density),
                    *[MusicPlanOperation(type="set_macro", name=name, value=value) for name, value in macros.items()],
                    MusicPlanOperation(type="set_pattern_events", value=[event.model_dump(exclude_none=True) for event in events]),
                ],
                pattern_events=events,
                automation=curves,
                shape=shape,
            )
        )
    if any(word in lower for word in space_words):
        patches.append(
            MusicPlanPatch(
                target="texture",
                reason="space/air request mapped to a subtle parameterized noise-bed texture",
                operations=[
                    MusicPlanOperation(type="set_enabled", value=True),
                    MusicPlanOperation(type="set_macro", name="preset", value="vinyl_air"),
                    MusicPlanOperation(type="set_macro", name="reverbWet", value=0.64),
                    MusicPlanOperation(type="set_volume", value=0.3),
                ],
            )
        )
    if any(word in lower for word in busy_words):
        patches.append(
            MusicPlanPatch(
                target="hats",
                reason="drive/busy request increases rhythmic surface density while preserving core groove",
                operations=[
                    MusicPlanOperation(type="set_enabled", value=True),
                    MusicPlanOperation(type="set_complexity", value=0.78),
                    MusicPlanOperation(type="set_macro", name="preset", value="airy_hats"),
                ],
            )
        )

    if not patches:
        patches.append(
            MusicPlanPatch(
                target="mix",
                reason="ambiguous request; keep current layers and ask LLM planner/model for richer interpretation when available",
                operations=[MusicPlanOperation(type="preserve_layer", value="all")],
            )
        )

    if loop_state and isinstance(loop_state.get("layers"), dict):
        enabled = [name for name, layer in loop_state["layers"].items() if isinstance(layer, dict) and layer.get("enabled")]
        for layer in enabled:
            if layer in {"kick", "bass"} and layer not in preserve:
                preserve.append(layer)  # keep groove anchors by default when current state says they are active

    return ArrangementPlan(
        intent=intent,
        timing=timing,
        summary="Tone.js knowledge-assisted parameterized arrangement plan",
        preserve=preserve,
        patches=patches,
        knowledge_entry_ids=knowledge_ids,
    )
