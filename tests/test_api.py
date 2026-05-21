from fastapi.testclient import TestClient

from live_loop.api import app
from live_loop.local_stt import SttTranscript


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
    client = TestClient(app)

    response = client.get('/api/stt/status')

    assert response.status_code == 200
    body = response.json()
    assert body['ok'] is True
    assert body['stt']['mode'] == 'faster-whisper'
    assert body['stt']['model_name'] == 'small'
    assert body['stt']['language'] == 'ko'
    assert 'runtime_available' in body['stt']


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


def test_command_endpoint_parses_korean_command():
    client = TestClient(app)

    response = client.post('/api/command', json={'text': '드럼 비트 좀 더 쪼개줘'})

    assert response.status_code == 200
    body = response.json()
    assert body['ok'] is True
    assert body['action']['intent'] == 'modify_layer'
    assert body['action']['target'] == 'drums'
    assert body['action']['delta'] > 0


def test_command_endpoint_returns_422_for_unsupported_command():
    client = TestClient(app)

    response = client.post('/api/command', json={'text': '우주 느낌으로 알아서 다 해줘'})

    assert response.status_code == 422
    assert '아직 이해하지 못한 명령' in response.json()['detail']
