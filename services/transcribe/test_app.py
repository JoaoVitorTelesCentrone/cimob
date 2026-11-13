"""Testes do serviço de transcrição com um motor falso (sem WhisperX nem rede)."""

import json
import threading
import urllib.error
import urllib.request

import pytest

from app import MAX_BYTES, make_server

SAMPLE_RATE = 16_000


class FakeEngine:
    """Decodifica qualquer áudio como `seconds` de silêncio e devolve um texto fixo."""

    def __init__(self, seconds: float, text: str = "uns setecentos mil", fail: bool = False):
        self.seconds = seconds
        self.text = text
        self.fail = fail
        self.transcribed = 0

    def load(self, path: str):
        if self.fail:
            raise RuntimeError("ffmpeg falhou")
        return [0.0] * int(self.seconds * SAMPLE_RATE)

    def transcribe(self, audio) -> str:
        self.transcribed += 1
        return self.text


@pytest.fixture
def serve():
    servers = []

    def start(engine):
        server = make_server(engine, port=0, max_seconds=60)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        servers.append(server)
        return f"http://127.0.0.1:{server.server_address[1]}"

    yield start
    for server in servers:
        server.shutdown()


def post(url: str, body: bytes, content_type: str = "audio/ogg"):
    req = urllib.request.Request(f"{url}/transcribe", data=body, method="POST")
    req.add_header("content-type", content_type)
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, json.loads(res.read())
    except urllib.error.HTTPError as err:
        return err.code, json.loads(err.read())


def test_transcreve_audio_curto(serve):
    url = serve(FakeEngine(seconds=12.4))
    status, body = post(url, b"ogg")
    assert status == 200
    assert body["text"] == "uns setecentos mil"
    assert body["duration_s"] == 12.4
    assert body["elapsed_s"] >= 0


def test_audio_acima_de_60s_e_recusado_sem_transcrever(serve):
    engine = FakeEngine(seconds=180)
    status, body = post(serve(engine), b"ogg")
    assert status == 413
    assert body == {"error": "too_long", "duration_s": 180.0}
    assert engine.transcribed == 0


def test_audio_que_nao_decodifica_e_erro_422(serve):
    status, body = post(serve(FakeEngine(seconds=5, fail=True)), b"lixo")
    assert status == 422
    assert body["error"] == "invalid_audio"


def test_corpo_vazio_e_400(serve):
    status, body = post(serve(FakeEngine(seconds=5)), b"")
    assert status == 400


def test_corpo_grande_demais_e_413_antes_de_ler(serve):
    url = serve(FakeEngine(seconds=5))
    req = urllib.request.Request(f"{url}/transcribe", data=b"x", method="POST")
    req.add_header("content-length", str(MAX_BYTES + 1))
    with pytest.raises(urllib.error.HTTPError) as err:
        urllib.request.urlopen(req)
    assert err.value.code == 413


def test_health(serve):
    with urllib.request.urlopen(f"{serve(FakeEngine(seconds=1))}/health") as res:
        assert res.status == 200
        assert json.loads(res.read())["status"] == "ok"


def test_rota_desconhecida_e_404(serve):
    with pytest.raises(urllib.error.HTTPError) as err:
        urllib.request.urlopen(f"{serve(FakeEngine(seconds=1))}/admin")
    assert err.value.code == 404
