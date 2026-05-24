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

def test_parse_texture_air_korean():
    action = parse_fast_command("공기감 있는 노이즈 질감 깔아줘")
    assert action is not None
    assert action.intent is Intent.ADD_LAYER
    assert action.target == "texture"

def test_parse_fx_riser_korean():
    action = parse_fast_command("다음 전환 전에 라이저 효과 넣어줘")
    assert action is not None
    assert action.intent is Intent.ADD_LAYER
    assert action.target == "fx"


def test_parse_expanded_fx_gestures_korean():
    for text in ["드랍 임팩트 쾅 넣어줘", "마지막 소리 딜레이로 던져줘", "전환 전에 스터터 게이트로 잘라줘"]:
        action = parse_fast_command(text)
        assert action is not None
        assert action.intent is Intent.ADD_LAYER
        assert action.target == "fx"
