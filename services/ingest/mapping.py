"""Tabela de preços da incorporadora → linhas de unidade (T4.5, doc 08).

Regras fixas, sem IA: o cabeçalho diz qual coluna é qual; a célula vira número só se for legível.
O que não dá para ler fica em branco e marcado para revisão: o bot nunca informa preço, área ou
disponibilidade que não estejam claros na tabela (regra 2 do AGENTS.md).
"""

from __future__ import annotations

import re
import unicodedata
from typing import Literal, Optional

from pydantic import BaseModel, Field

Status = Literal["available", "reserved", "sold"]


class UnitRow(BaseModel):
    code: str
    floor: Optional[int] = None
    area_m2: Optional[float] = None
    bedrooms: Optional[int] = None
    parking: Optional[int] = None
    price: Optional[float] = None
    status: Optional[Status] = None
    needs_review: bool = False
    issues: list[str] = Field(default_factory=list)


class Extraction(BaseModel):
    tables: int = 0
    rows: list[UnitRow] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


def _fold(text: str) -> str:
    """Minúsculas, sem acento e com espaços simples."""
    norm = unicodedata.normalize("NFKD", str(text))
    return " ".join("".join(c for c in norm if not unicodedata.combining(c)).lower().split())


def _number(raw: str, *, decimals_ok: bool) -> Optional[float]:
    text = re.sub(r"(?i)r\$|m²|m2", "", str(raw)).strip().replace(" ", "")
    if not text or not re.fullmatch(r"[\d.,]+", text) or not re.search(r"\d", text):
        return None
    if "," in text and "." in text:
        if text.rfind(",") < text.rfind("."):
            return None  # formato estrangeiro: melhor revisar do que adivinhar
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    elif "." in text:
        groups = text.split(".")
        if all(len(g) == 3 for g in groups[1:]):
            text = text.replace(".", "")  # 765.000 = milhar
        elif not decimals_ok or len(groups) > 2:
            return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_price(raw: str) -> Optional[float]:
    value = _number(raw, decimals_ok=True)
    return value if value is not None and value > 0 else None


def parse_area(raw: str) -> Optional[float]:
    value = _number(raw, decimals_ok=True)
    return value if value is not None and value > 0 else None


def parse_int(raw: str) -> Optional[int]:
    match = re.fullmatch(r"(\d{1,3})\s*[a-zçº ª.]*", _fold(raw))
    return int(match.group(1)) if match else None


def parse_status(raw: str) -> Optional[Status]:
    text = _fold(raw)
    if re.match(r"^(disp|livre|a venda)", text):
        return "available"
    if re.match(r"^(reserv|em negocia|bloque|proposta)", text):
        return "reserved"
    if re.match(r"^vendid", text):
        return "sold"
    return None


# Colunas: (campo, palavras que identificam, palavras que excluem, palavras preferidas)
_PRICE_EXCLUDE = ("sinal", "parcela", "entrada", "mensa", "anua", "intermed", "chave", "m2", "m²", "financ")
COLUMNS = {
    "code": (("unidade", "unid", "apto", "apartamento", "apt", "casa", "lote", "codigo", "cod"), ("valor", "preco", "area"), ()),
    "floor": (("andar", "pavimento", "pav"), (), ()),
    "area_m2": (("area", "m2", "m²", "metragem"), ("valor", "preco"), ("privativa", "util")),
    "bedrooms": (("dorm", "quarto"), (), ()),
    "parking": (("vaga",), (), ()),
    "price": (("valor", "preco", "total", "vista"), _PRICE_EXCLUDE, ("total", "vista")),
    "status": (("situacao", "status", "disponib", "sit"), (), ()),
}


def map_columns(header: list[str]) -> dict[str, int]:
    """Índice de cada campo reconhecido no cabeçalho."""
    folded = [_fold(h) for h in header]
    found: dict[str, int] = {}
    for field, (words, exclude, prefer) in COLUMNS.items():
        candidates = [
            i
            for i, h in enumerate(folded)
            if i not in found.values()
            and any(re.search(rf"\b{re.escape(w)}", h) for w in words)
            and not any(x in h for x in exclude)
        ]
        if not candidates:
            continue
        preferred = [i for i in candidates if any(p in folded[i] for p in prefer)]
        found[field] = (preferred or candidates)[0]
    return found


def _code(raw: str, prefix: str) -> Optional[str]:
    code = re.sub(r"\s+", "-", str(raw).strip().upper())
    if not re.search(r"\d", code):
        return None  # linha de total, subtítulo ou vazia
    return f"{prefix}{code}" if code.isdigit() else code


def extract_rows(tables: list[tuple[list[str], list[list[str]]]], prefix: str = "") -> Extraction:
    """Linhas de todas as tabelas reconhecidas (com coluna de unidade e de preço ou situação)."""
    out = Extraction()
    seen: set[str] = set()
    for header, cells in tables:
        cols = map_columns(header)
        if "code" not in cols or not ({"price", "status"} & cols.keys()):
            continue
        out.tables += 1
        if "status" not in cols:
            warning = "sem coluna de situação: unidades consideradas disponíveis"
            if warning not in out.warnings:
                out.warnings.append(warning)

        for line in cells:
            cell = lambda field: str(line[cols[field]]) if field in cols and cols[field] < len(line) else ""  # noqa: E731
            code = _code(cell("code"), prefix)
            if code is None:
                continue
            if code in seen:
                out.warnings.append(f"código repetido ignorado: {code}")
                continue
            seen.add(code)

            row = UnitRow(
                code=code,
                floor=parse_int(cell("floor")) if "floor" in cols else None,
                area_m2=parse_area(cell("area_m2")) if "area_m2" in cols else None,
                bedrooms=parse_int(cell("bedrooms")) if "bedrooms" in cols else None,
                parking=parse_int(cell("parking")) if "parking" in cols else None,
                price=parse_price(cell("price")) if "price" in cols else None,
                status=parse_status(cell("status")) if "status" in cols else "available",
            )
            if "price" in cols and row.price is None:
                row.issues.append("preço ilegível")
            if "status" in cols and row.status is None:
                row.issues.append("situação ilegível")
            row.needs_review = bool(row.issues)
            out.rows.append(row)
    return out
