from live_loop.arrangement_plan import compose_rule_arrangement_plan


def test_arrangement_plan_maps_vague_transition_to_declarative_fx_plan():
    plan = compose_rule_arrangement_plan("드랍 전에 숨 한번 참는 느낌으로 잘라줘. 베이스는 유지")

    assert plan.intent == "transition"
    assert plan.timing == "next_phrase"
    assert "bass" in plan.preserve
    assert "noise-fx-gestures" in plan.knowledge_entry_ids
    fx_patch = next(patch for patch in plan.patches if patch.target == "fx")
    assert fx_patch.operations
    assert fx_patch.shape is not None
    assert fx_patch.shape.type == "tension_cut"
    assert fx_patch.pattern_events
    assert fx_patch.automation
    assert any(operation.type == "set_pattern_events" for operation in fx_patch.operations)
    assert not any(operation.type == "set_macro" and operation.name == "preset" for operation in fx_patch.operations)


def test_arrangement_plan_uses_loop_state_to_preserve_active_groove_anchors():
    plan = compose_rule_arrangement_plan(
        "여기서 좀 들어올리는 느낌 줘",
        {"layers": {"kick": {"enabled": True}, "bass": {"enabled": True}, "pad": {"enabled": False}}},
    )

    assert "kick" in plan.preserve
    assert "bass" in plan.preserve
