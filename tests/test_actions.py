from live_loop.actions import Intent, parse_fast_command


def test_parse_kick_korean():
    action = parse_fast_command("킥 깔아줘")
    assert action is not None
    assert action.intent is Intent.ADD_LAYER
    assert action.target == "kick"


def test_parse_drums_more_complex_korean():
    action = parse_fast_command("드럼 비트 좀 더 쪼개줘")
    assert action is not None
    assert action.intent is Intent.MODIFY_LAYER
    assert action.target == "drums"
    assert action.delta > 0


def test_parse_bass_mute_korean():
    action = parse_fast_command("베이스 빼줘")
    assert action is not None
    assert action.intent is Intent.MUTE_LAYER
    assert action.target == "bass"
