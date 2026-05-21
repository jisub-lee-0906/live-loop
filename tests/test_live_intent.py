from live_loop.live_intent import LiveCodeIntent, compose_rule_intent, parse_model_intent


def test_parse_model_intent_extracts_valid_json():
    raw = '```json\n{"style":"uk_garage","targets":["drums","bass"],"constraints":["shuffle_hats","offbeat_bass"],"timing":"next_bar"}\n```'

    intent = parse_model_intent(raw, fallback_text='garage')

    assert intent.style == 'uk_garage'
    assert intent.targets == ['drums', 'bass']
    assert 'shuffle_hats' in intent.constraints


def test_parse_model_intent_maps_freeform_intent_to_constraints():
    raw = '{"command":"x","intent":"Generate UK garage music style using shuffling and offbeat bass"}'

    intent = parse_model_intent(raw, fallback_text='x')

    assert intent.style == 'uk_garage'
    assert 'shuffle_hats' in intent.constraints
    assert 'offbeat_bass' in intent.constraints


def test_parse_model_intent_falls_back_to_rules_for_invalid_output():
    intent = parse_model_intent('not json', fallback_text='하우스 베이스 통통')

    assert intent.style == 'house'
    assert 'offbeat_bass' in intent.constraints


def test_rule_intent_detects_uk_garage():
    intent = compose_rule_intent('UK garage 느낌으로 셔플 하이햇')

    assert isinstance(intent, LiveCodeIntent)
    assert intent.style == 'uk_garage'
    assert intent.timing == 'next_bar'
