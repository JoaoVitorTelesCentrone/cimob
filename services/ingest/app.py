"""Serviço de importação de PDF da incorporadora (T4.5).

POST /extract?prefix=AUR- com o PDF no corpo e `Authorization: Bearer <INGEST_SECRET>` →
{"tables", "rows": [...], "warnings": [...]} (ver mapping.py). Só o CRM conhece a chave.
O Docling acha as tabelas; as regras fixas de mapping.py leem as colunas. Sem OCR: PDF escaneado
(imagem) não tem tabela reconhecida e volta 422 no_table.

O PDF vai para um arquivo temporário, apagado logo depois; nada é guardado.
"""

from __future__ import annotations

import hmac
import json
import logging
import os
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Protocol
from urllib.parse import parse_qs, urlparse

from mapping import extract_rows

MAX_BYTES = 20 * 1024 * 1024

log = logging.getLogger("ingest")

Table = tuple[list[str], list[list[str]]]


class Reader(Protocol):
    def tables_of(self, path: str) -> list[Table]: ...


class DoclingReader:
    """Docling no CPU, só estrutura de tabela (sem OCR). Os modelos vêm dentro da imagem."""

    def __init__(self) -> None:
        # Importado aqui: os testes não precisam do Docling.
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        from docling.document_converter import DocumentConverter, PdfFormatOption

        options = PdfPipelineOptions(do_ocr=False, do_table_structure=True)
        self._converter = DocumentConverter(
            format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=options)}
        )

    def tables_of(self, path: str) -> list[Table]:
        doc = self._converter.convert(path).document
        tables: list[Table] = []
        for table in doc.tables:
            df = table.export_to_dataframe(doc=doc)
            header = [str(c) for c in df.columns]
            cells = [["" if v is None else str(v) for v in row] for row in df.values.tolist()]
            tables.append((header, cells))
        return tables


def make_server(reader: Reader, port: int, secret: str) -> ThreadingHTTPServer:
    lock = threading.Lock()
    expected = f"Bearer {secret}".encode()

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
            url = urlparse(self.path)
            if url.path != "/extract":
                self._json(404, {"error": "not_found"})
                return
            auth = (self.headers.get("authorization") or "").encode()
            if not hmac.compare_digest(auth, expected):
                self._json(401, {"error": "unauthorized"})
                return
            size = int(self.headers.get("content-length") or 0)
            if size > MAX_BYTES:
                self._json(413, {"error": "too_large"})
                return
            if size <= 0:
                self._json(400, {"error": "empty"})
                return
            body = self.rfile.read(size)
            if not body.startswith(b"%PDF"):
                self._json(415, {"error": "not_pdf"})
                return
            prefix = (parse_qs(url.query).get("prefix") or [""])[0][:20]

            started = time.perf_counter()
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                path = tmp.name
            try:
                with open(path, "wb") as f:
                    f.write(body)
                with lock:  # o CPU é o gargalo: um PDF por vez
                    try:
                        tables = reader.tables_of(path)
                    except Exception:  # noqa: BLE001 - PDF que o Docling não abre
                        log.warning("pdf ilegivel (%d bytes)", size)
                        self._json(422, {"error": "unreadable_pdf"})
                        return
                result = extract_rows(tables, prefix=prefix)
                if result.tables == 0:
                    self._json(422, {"error": "no_table"})
                    return
                log.info(
                    "importado: %d tabelas, %d linhas em %.1f s",
                    result.tables, len(result.rows), time.perf_counter() - started,
                )
                self._json(200, result.model_dump())
            except Exception as exc:  # noqa: BLE001 - qualquer falha vira 500 sem derrubar o serviço
                log.exception("falha na importacao")
                self._json(500, {"error": type(exc).__name__})
            finally:
                os.unlink(path)

    return ThreadingHTTPServer(("0.0.0.0", port), Handler)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    secret = os.environ.get("INGEST_SECRET", "")
    if len(secret) < 16:
        raise SystemExit("defina INGEST_SECRET (16+ caracteres): só o CRM pode chamar o serviço")
    started = time.perf_counter()
    reader = DoclingReader()
    log.info("docling pronto em %.1f s", time.perf_counter() - started)
    server = make_server(reader, port=int(os.environ.get("PORT", "8000")), secret=secret)
    log.info("ouvindo na porta %d", server.server_address[1])
    server.serve_forever()


if __name__ == "__main__":
    main()
