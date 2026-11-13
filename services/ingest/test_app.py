"""Testes do serviço de importação com um leitor falso (sem Docling nem rede)."""

import json
import threading
import urllib.error
import urllib.request

import pytest

from app import MAX_BYTES, make_server

SECRET = "segredo-do-crm-123"
PDF = b"%PDF-1.7\n...conteudo..."
HEADER = ["Unidade", "Área Privativa", "Dorms", "Vagas", "Valor Total", "Situação"]


class FakeReader:
    """Devolve tabelas fixas para qualquer PDF; registra quantos arquivos leu."""

    def __init__(self, tables=None, fail: bool = False):
        self.tables = tables if tables is not None else [(HEADER, [["502", "68,50", "2", "1", "765.000", "Disponível"]])]
        self.fail = fail
        self.read = 0

    def tables_of(self, path: str):
        self.read += 1
        if self.fail:
            raise RuntimeError("pdf quebrado")
        return self.tables


@pytest.fixture
def serve():
    servers = []

    def start(reader):
        server = make_server(reader, port=0, secret=SECRET)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        servers.append(server)
        return f"http://127.0.0.1:{server.server_address[1]}"

    yield start
    for s in servers:
        s.shutdown()


def post(url, body=PDF, secret=SECRET, path="/extract?prefix=AUR-"):
    req = urllib.request.Request(url + path, data=body, method="POST")
    if secret:
        req.add_header("authorization", f"Bearer {secret}")
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, json.loads(res.read())
    except urllib.error.HTTPError as err:
        return err.code, json.loads(err.read())


def test_pdf_vira_linhas_com_o_prefixo(serve):
    status, body = post(serve(FakeReader()))
    assert status == 200
    assert body["tables"] == 1
    assert body["rows"][0]["code"] == "AUR-502"
    assert body["rows"][0]["price"] == 765000.0


def test_sem_a_chave_do_crm_nao_le_nada(serve):
    reader = FakeReader()
    url = serve(reader)
    assert post(url, secret=None)[0] == 401
    assert post(url, secret="errado")[0] == 401
    assert reader.read == 0


def test_so_aceita_pdf_e_ate_o_limite(serve):
    url = serve(FakeReader())
    assert post(url, body=b"GIF89a")[1] == {"error": "not_pdf"}
    assert post(url, body=b"")[0] == 400
    req = urllib.request.Request(url + "/extract", data=b"%PDF", method="POST")
    req.add_header("authorization", f"Bearer {SECRET}")
    req.add_header("content-length", str(MAX_BYTES + 1))
    with pytest.raises(urllib.error.HTTPError) as err:
        urllib.request.urlopen(req)
    assert err.value.code == 413


def test_pdf_sem_tabela_reconhecida(serve):
    status, body = post(serve(FakeReader(tables=[(["Mês", "Parcela"], [["jan", "3.000"]])])))
    assert status == 422
    assert body == {"error": "no_table"}


def test_pdf_que_o_leitor_nao_abre(serve):
    status, body = post(serve(FakeReader(fail=True)))
    assert status == 422
    assert body == {"error": "unreadable_pdf"}


def test_health_nao_pede_chave(serve):
    with urllib.request.urlopen(serve(FakeReader()) + "/health") as res:
        assert json.loads(res.read()) == {"status": "ok"}
