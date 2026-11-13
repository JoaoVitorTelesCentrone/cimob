"""Mapeamento da tabela de preços: cabeçalho → colunas, e células → valores (sem inventar)."""

from mapping import extract_rows, parse_area, parse_int, parse_price, parse_status


def test_preco_no_formato_brasileiro():
    assert parse_price("R$ 765.000,00") == 765000.0
    assert parse_price("765.000") == 765000.0
    assert parse_price("1.234.567,89") == 1234567.89
    assert parse_price("R$765000") == 765000.0


def test_preco_ilegivel_ou_vazio_e_nulo():
    assert parse_price("") is None
    assert parse_price("consulte") is None
    assert parse_price("R$ 7?5.000") is None
    assert parse_price("0") is None


def test_area_e_inteiros():
    assert parse_area("68,50 m²") == 68.5
    assert parse_area("120") == 120.0
    assert parse_area("—") is None
    assert parse_int("2") == 2
    assert parse_int("2 dorms") == 2
    assert parse_int("2+1") is None
    assert parse_int("") is None


def test_status():
    assert parse_status("Disponível") == "available"
    assert parse_status("DISP.") == "available"
    assert parse_status("Reservado") == "reserved"
    assert parse_status("Em negociação") == "reserved"
    assert parse_status("Vendido") == "sold"
    assert parse_status("") is None
    assert parse_status("???") is None


HEADER = ["Unidade", "Andar", "Área Privativa (m²)", "Dorms", "Vagas", "Valor Total", "Situação"]


def test_tabela_completa_vira_linhas_prontas():
    result = extract_rows(
        [
            (
                HEADER,
                [
                    ["AUR-502", "5", "68,50", "2", "1", "R$ 765.000,00", "Disponível"],
                    ["AUR-503", "5", "72,00", "3", "2", "R$ 812.000,00", "Vendido"],
                ],
            )
        ],
        prefix="",
    )
    assert [r.model_dump() for r in result.rows] == [
        {
            "code": "AUR-502",
            "floor": 5,
            "area_m2": 68.5,
            "bedrooms": 2,
            "parking": 1,
            "price": 765000.0,
            "status": "available",
            "needs_review": False,
            "issues": [],
        },
        {
            "code": "AUR-503",
            "floor": 5,
            "area_m2": 72.0,
            "bedrooms": 3,
            "parking": 2,
            "price": 812000.0,
            "status": "sold",
            "needs_review": False,
            "issues": [],
        },
    ]
    assert result.tables == 1


def test_preco_ilegivel_fica_em_branco_e_marcado_para_revisao():
    result = extract_rows([(HEADER, [["AUR-704", "7", "68,50", "2", "1", "R$ 7?5.000", "Disponível"]])])
    row = result.rows[0]
    assert row.price is None
    assert row.needs_review is True
    assert row.issues == ["preço ilegível"]


def test_codigo_so_com_numero_ganha_o_prefixo_do_empreendimento():
    result = extract_rows([(["Apto", "Preço", "Status"], [["502", "765.000", "Disp."]])], prefix="AUR-")
    assert result.rows[0].code == "AUR-502"


def test_sem_coluna_de_status_a_tabela_de_precos_e_estoque_disponivel():
    result = extract_rows([(["Apto", "Preço"], [["502", "765.000"]])], prefix="AUR-")
    assert result.rows[0].status == "available"
    assert result.warnings == ["sem coluna de situação: unidades consideradas disponíveis"]


def test_status_ilegivel_marca_para_revisao():
    result = extract_rows([(["Unidade", "Valor", "Situação"], [["AUR-1", "500.000", "???"]])])
    assert result.rows[0].status is None
    assert result.rows[0].needs_review is True
    assert result.rows[0].issues == ["situação ilegível"]


def test_escolhe_o_valor_total_e_nao_sinal_ou_parcela():
    header = ["Unidade", "Sinal", "Parcelas", "Valor à vista", "Situação"]
    result = extract_rows([(header, [["AUR-1", "50.000", "60x 3.000", "600.000", "Disponível"]])])
    assert result.rows[0].price == 600000.0


def test_prefere_area_privativa_a_area_total():
    header = ["Unidade", "Área Total", "Área Privativa", "Valor"]
    result = extract_rows([(header, [["AUR-1", "110,00", "68,50", "600.000"]])])
    assert result.rows[0].area_m2 == 68.5


def test_tabela_sem_coluna_de_unidade_e_ignorada():
    result = extract_rows([(["Mês", "Parcela"], [["jan", "3.000"]])])
    assert result.rows == []
    assert result.tables == 0


def test_tabela_em_varias_paginas_e_codigo_repetido():
    result = extract_rows(
        [
            (HEADER, [["AUR-101", "1", "68", "2", "1", "500.000", "Disponível"]]),
            (HEADER, [["AUR-101", "1", "68", "2", "1", "510.000", "Disponível"], ["AUR-102", "1", "70", "2", "1", "520.000", "Reservado"]]),
        ]
    )
    assert [r.code for r in result.rows] == ["AUR-101", "AUR-102"]
    assert result.tables == 2
    assert result.warnings == ["código repetido ignorado: AUR-101"]


def test_linha_sem_codigo_e_linhas_de_total_sao_ignoradas():
    result = extract_rows([(HEADER, [["", "", "", "", "", "", ""], ["Total", "", "", "", "", "R$ 1.000.000", ""]])])
    assert result.rows == []
