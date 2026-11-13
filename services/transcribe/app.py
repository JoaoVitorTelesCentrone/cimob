"""Serviço de transcrição de áudios do WhatsApp (doc 04, doc 10).

POST /transcribe com o áudio no corpo → {"text", "duration_s", "elapsed_s"}.
Áudio acima de MAX_SECONDS → 413 {"error": "too_long", "duration_s"} (o bot passa ao corretor).
Roda WhisperX no CPU; o modelo é carregado uma vez, na subida. Um áudio por vez (lock):
o CPU é o gargalo, e a fila `transcribe` do bot já serializa os pedidos.

LGPD: o áudio vai para um arquivo temporário, apagado logo depois; o texto não vai para o log.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Protocol

SAMPLE_RATE = 16_000
MAX_BYTES = 16 * 1024 * 1024  # limite da Cloud API para áudio

log = logging.getLogger("transcribe")


class Engine(Protocol):
    def load(self, path: str) -> Any: ...
    def transcribe(self, audio: Any) -> str: ...


class WhisperXEngine:
    """WhisperX (faster-whisper por baixo) no CPU, em português."""

    def __init__(self, model: str, compute_type: str, language: str, threads: int):
        import whisperx  # importado aqui: os testes não precisam do WhisperX

        self._whisperx = whisperx
        self._language = language
        self._model = whisperx.load_model(
            model, device="cpu", compute_type=compute_type, language=language, threads=threads
        )

    def load(self, path: str) -> Any:
        return self._whisperx.load_audio(path)  # ffmpeg → 16 kHz mono

    def transcribe(self, audio: Any) -> str:
        result = self._model.transcribe(audio, batch_size=4, language=self._language)
        return " ".join(seg["text"].strip() for seg in result["segments"]).strip()


def make_server(engine: Engine, port: int, max_seconds: float) -> ThreadingHTTPServer:
    lock = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def _json(self, status: int, body: dict) -> None:
            data = json.dumps(body, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *args: Any) -> None:  # sem log de acesso padrão
            pass

        def do_GET(self) -> None:
            if self.path == "/health":
                self._json(200, {"status": "ok"})
            else:
                self._json(404, {"error": "not_found"})

        def do_POST(self) -> None:
            if self.path != "/transcribe":
                self._json(404, {"error": "not_found"})
                return
            size = int(self.headers.get("content-length") or 0)
            if size > MAX_BYTES:
                self._json(413, {"error": "too_large"})
                return
            if size <= 0:
                self._json(400, {"error": "empty"})
                return
            body = self.rfile.read(size)

            started = time.perf_counter()
            with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as tmp:
                path = tmp.name
            try:
                with open(path, "wb") as f:
                    f.write(body)
                with lock:
                    try:
                        audio = engine.load(path)
                    except Exception:  # ffmpeg não entendeu o arquivo
                        log.warning("audio invalido (%d bytes)", size)
                        self._json(422, {"error": "invalid_audio"})
                        return
                    duration = round(len(audio) / SAMPLE_RATE, 1)
                    if duration > max_seconds:
                        self._json(413, {"error": "too_long", "duration_s": duration})
                        return
                    text = engine.transcribe(audio)
                elapsed = round(time.perf_counter() - started, 2)
                log.info("transcrito: %.1f s de audio em %.2f s", duration, elapsed)
                self._json(200, {"text": text, "duration_s": duration, "elapsed_s": elapsed})
            except Exception as exc:  # noqa: BLE001 - qualquer falha vira 500 sem derrubar o serviço
                log.exception("falha na transcricao")
                self._json(500, {"error": type(exc).__name__})
            finally:
                os.unlink(path)

    return ThreadingHTTPServer(("0.0.0.0", port), Handler)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    started = time.perf_counter()
    engine = WhisperXEngine(
        model=os.environ.get("WHISPER_MODEL", "small"),
        compute_type=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"),
        language=os.environ.get("WHISPER_LANGUAGE", "pt"),
        # Mais de 4 threads deixou a transcrição mais lenta no teste (disputa de CPU).
        threads=int(os.environ.get("WHISPER_THREADS", "0")) or min(os.cpu_count() or 2, 4),
    )
    log.info("modelo carregado em %.1f s", time.perf_counter() - started)
    server = make_server(
        engine,
        port=int(os.environ.get("PORT", "8000")),
        max_seconds=float(os.environ.get("MAX_SECONDS", "60")),
    )
    log.info("ouvindo na porta %d", server.server_address[1])
    server.serve_forever()


if __name__ == "__main__":
    main()
