# Importação de PDF da incorporadora (T4.5): Docling no CPU, sem OCR. Exposto só pelo Caddy, com chave.
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
# Torch do índice de CPU: sem as libs de GPU da NVIDIA (vários GB que o Hetzner sem GPU não usa).
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu "torch==2.8.*" "torchvision==0.23.*" \
 && pip install --no-cache-dir -r requirements.txt

RUN useradd --create-home ingest && mkdir -p /app/models && chown ingest /app /app/models
USER ingest

# Modelos de layout e de tabela baixados na construção: o contêiner sobe sem internet.
ENV HF_HOME=/app/models DOCLING_ARTIFACTS_PATH=/app/models/docling
RUN docling-tools models download layout tableformer -o /app/models/docling

COPY --chown=ingest app.py mapping.py ./
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1
CMD ["python", "app.py"]
