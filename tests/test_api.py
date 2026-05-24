from dataclasses import dataclass

from fastapi.testclient import TestClient

from live_loop.api import app
from live_loop.local_stt import LocalSpeechTranscriber, SttTranscript


def test_health_reports_ready():
    client = TestClient(app)

    response = client.get('/api/health')

    assert response.status_code == 200
    assert response.json() == {'ok': True, 'service': 'live-loop-api'}


def test_model_status_reports_local_model_slot(monkeypatch, tmp_path):
    model = tmp_path / 'live-coder.gguf'
    monkeypatch.setenv('LIVE_LOOP_LLM_MODEL', str(model))
    client = TestClient(app)

    response = client.get('/api/model/status')

    assert response.status_code == 200
    body = response.json()
    assert body['ok'] is True
    assert body['model']['mode'] == 'local-gguf'
    assert body['model']['model_path'] == str(model.resolve())
    assert body['model']['ready'] is False


def test_stt_status_reports_faster_whisper_defaults(monkeypatch):
    monkeypatch.setenv('LIVE_LOOP_STT_MODEL', 'small')
    monkeypatch.setenv('LIVE_LOOP_STT_LANGUAGE', 'ko')
    monkeypatch.delenv('LIVE_LOOP_STT_BEAM_SIZE', raising=False)
    client = TestClient(app)

    response = client.get('/api/stt/status')

    assert response.status_code == 200
    body = response.json()
    assert body['ok'] is True
    assert body['stt']['mode'] == 'faster-whisper'
    assert body['stt']['model_name'] == 'small'
    assert body['stt']['language'] == 'ko'
    assert body['stt']['beam_size'] == 5
    assert body['stt']['has_initial_prompt'] is True
    assert 'runtime_available' in body['stt']


def test_stt_transcribe_retries_without_vad_when_short_command_is_filtered(monkeypatch, tmp_path):
    @dataclass
    class FakeSegment:
        text: str

    @dataclass
    class FakeInfo:
        language: str = 'ko'
        duration: float = 0.8

    class FakeModel:
        def __init__(self):
            self.calls: list[bool] = []

        def transcribe(self, path, *, language, beam_size, vad_filter, initial_prompt, condition_on_previous_text, temperature):
            assert path == str(audio_path)
            assert language == 'ko'
            assert beam_size == 5
            assert '킥 깔아줘' in initial_prompt
            assert condition_on_previous_text is False
            assert temperature == 0.0
            self.calls.append(vad_filter)
            if vad_filter:
                return [], FakeInfo()
            return [FakeSegment('킥 깔아줘')], FakeInfo()

    import live_loop.local_stt as local_stt

    audio_path = tmp_path / 'short-command.webm'
    audio_path.write_bytes(b'audio')
    monkeypatch.setattr(local_stt, '_runtime_available', lambda: True)
    transcriber = LocalSpeechTranscriber()
    fake_model = FakeModel()
    monkeypatch.setattr(transcriber, '_model', fake_model)

    transcript = transcriber.transcribe_file(audio_path, language='ko')

    assert transcript.text == '킥 깔아줘'
    assert fake_model.calls == [True, False]


def test_stt_retries_without_vad_when_vad_text_does_not_look_like_live_command(monkeypatch, tmp_path):
    @dataclass
    class FakeSegment:
        text: str

    @dataclass
    class FakeInfo:
        language: str = 'ko'
        duration: float = 1.0

    class FakeModel:
        def __init__(self):
            self.calls: list[bool] = []

        def transcribe(self, path, *, language, beam_size, vad_filter, initial_prompt, condition_on_previous_text, temperature):
            self.calls.append(vad_filter)
            if vad_filter:
                return [FakeSegment('기깔라 줘')], FakeInfo()
            return [FakeSegment('킥 깔아줘')], FakeInfo()

    import live_loop.local_stt as local_stt

    audio_path = tmp_path / 'noisy-command.webm'
    audio_path.write_bytes(b'audio')
    monkeypatch.setattr(local_stt, '_runtime_available', lambda: True)
    transcriber = LocalSpeechTranscriber()
    fake_model = FakeModel()
    monkeypatch.setattr(transcriber, '_model', fake_model)

    transcript = transcriber.transcribe_file(audio_path, language='ko')

    assert transcript.text == '킥 깔아줘'
    assert fake_model.calls == [True, False]


def test_stt_clears_non_command_hallucination_when_retry_is_not_a_live_command(monkeypatch, tmp_path):
    @dataclass
    class FakeSegment:
        text: str

    @dataclass
    class FakeInfo:
        language: str = 'ko'
        duration: float = 0.4

    class FakeModel:
        def transcribe(self, path, *, language, beam_size, vad_filter, initial_prompt, condition_on_previous_text, temperature):
            if vad_filter:
                return [FakeSegment('이 시각 세계였습니다')], FakeInfo()
            return [FakeSegment('감사합니다')], FakeInfo()

    import live_loop.local_stt as local_stt

    audio_path = tmp_path / 'hallucination.wav'
    audio_path.write_bytes(b'audio')
    monkeypatch.setattr(local_stt, '_runtime_available', lambda: True)
    transcriber = LocalSpeechTranscriber()
    monkeypatch.setattr(transcriber, '_model', FakeModel())

    transcript = transcriber.transcribe_file(audio_path, language='ko')

    assert transcript.text == ''


def test_stt_transcribe_endpoint_uses_cached_transcriber(monkeypatch):
    class FakeTranscriber:
        def transcribe_upload(self, file, *, suffix: str = '.webm', language: str | None = None):
            assert file.read() == b'audio-bytes'
            assert suffix == '.webm'
            assert language == 'ko'
            return SttTranscript(text='킥 깔아줘', language='ko', duration=1.2, model_name='small', latency_ms=12)

    import live_loop.api as api

    monkeypatch.setattr(api, 'get_local_transcriber', lambda: FakeTranscriber())
    client = TestClient(app)

    response = client.post(
        '/api/stt/transcribe?language=ko',
        files={'file': ('recording.webm', b'audio-bytes', 'audio/webm')},
    )

    assert response.status_code == 200
    body = response.json()
    assert body['ok'] is True
    assert body['source'] == 'faster-whisper'
    assert body['transcript']['text'] == '킥 깔아줘'


def test_stt_transcribe_rejects_non_audio_upload():
    client = TestClient(app)

    response = client.post('/api/stt/transcribe', files={'file': ('note.txt', b'not-audio', 'text/plain')})

    assert response.status_code == 415


def test_llm_intent_endpoint_falls_back_to_rules_when_model_missing(monkeypatch, tmp_path):
    model = tmp_path / 'missing.gguf'
    monkeypatch.setenv('LIVE_LOOP_LLM_MODEL', str(model))
    client = TestClient(app)

    response = client.post('/api/llm/intent', json={'text': 'UK garage 느낌으로 셔플 하이햇'})

    assert response.status_code == 200
    body = response.json()
    assert body['ok'] is True
    assert body['source'] == 'rules-fallback'
    assert body['intent']['style'] == 'uk_garage'
    assert 'shuffle_hats' in body['intent']['constraints']


def test_llm_prewarm_endpoint_loads_local_coder(monkeypatch):
    class FakeCoder:
        def ready(self):
            return True

        def interpret_intent(self, text: str):
            calls.append(text)
            return object()

    calls: list[str] = []
    ticks = iter([100.0, 101.234])
    import live_loop.api as api

    monkeypatch.setattr(api, 'get_local_coder', lambda: FakeCoder())
    monkeypatch.setattr(api, 'perf_counter', lambda: next(ticks))
    client = TestClient(app)

    response = client.post('/api/llm/prewarm')

    assert response.status_code == 200
    body = response.json()
    assert body['ok'] is True
    assert body['ready'] is True
    assert body['source'] == 'local-gguf'
    assert body['latency_ms'] == 1234
    assert calls == ['킥 깔아줘']


def test_llm_prewarm_endpoint_skips_when_model_not_ready(monkeypatch):
    class MissingCoder:
        def ready(self):
            return False

        def interpret_intent(self, text: str):
            raise AssertionError('must not prewarm when not ready')

    import live_loop.api as api

    monkeypatch.setattr(api, 'get_local_coder', lambda: MissingCoder())
    client = TestClient(app)

    response = client.post('/api/llm/prewarm')

    assert response.status_code == 200
    body = response.json()
    assert body['ok'] is True
    assert body['ready'] is False
    assert body['source'] == 'not-ready'
    assert body['latency_ms'] == 0


def test_command_endpoint_parses_korean_command():
    client = TestClient(app)

    response = client.post('/api/command', json={'text': '드럼 비트 좀 더 쪼개줘'})

    assert response.status_code == 200
    body = response.json()
    assert body['ok'] is True
    assert body['action']['intent'] == 'modify_layer'
    assert body['action']['target'] == 'drums'
    assert body['action']['delta'] > 0


def test_command_endpoint_parses_korean_drum_mute_command():
    client = TestClient(app)

    response = client.post('/api/command', json={'text': '드럼비트 꺼줘'})

    assert response.status_code == 200
    body = response.json()
    assert body['ok'] is True
    assert body['action']['intent'] == 'mute_layer'
    assert body['action']['target'] == 'drums'


def test_command_endpoint_returns_422_for_unsupported_command():
    client = TestClient(app)

    response = client.post('/api/command', json={'text': '우주 느낌으로 알아서 다 해줘'})

    assert response.status_code == 422
    assert '아직 이해하지 못한 명령' in response.json()['detail']


def test_tone_knowledge_search_endpoint_returns_retrieved_docs():
    client = TestClient(app)

    response = client.get('/api/tone-knowledge/search', params={'q': '드랍 전에 스터터 게이트 딜레이', 'limit': 2})

    assert response.status_code == 200
    payload = response.json()
    assert payload['ok'] is True
    assert payload['results']
    assert any(result['entry']['id'] == 'noise-fx-gestures' for result in payload['results'])


def test_arrange_endpoint_returns_declarative_plan_not_generated_js():
    client = TestClient(app)

    response = client.post('/api/llm/arrange', json={'text': '다음 파트 전에 좀 들어올리고 딜레이로 넘겨줘'})

    assert response.status_code == 200
    payload = response.json()
    assert payload['ok'] is True
    assert payload['source'] == 'rules-with-tone-knowledge'
    assert payload['plan']['timing'] == 'next_phrase'
    assert payload['plan']['patches'][0]['target'] == 'fx'
    assert 'noise-fx-gestures' in payload['plan']['knowledge_entry_ids']
