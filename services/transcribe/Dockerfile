# Serviço de transcrição (WhisperX no CPU). Rede interna do Compose; não é exposto.
FROM python:3.11-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
# Versões exigidas pelo whisperx 3.8.6, do índice de CPU. Sem isso o pip baixa o torch com CUDA
# do PyPI (vários GB de libs da NVIDIA que o Hetzner sem GPU não usa).
# O triton (compilador de GPU, ~1 GB) vem como dependência do whisperx, mas não é usado no CPU.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu \
      "torch==2.8.*" "torchaudio==2.8.*" "torchvision==0.23.*" \
 && pip install --no-cache-dir -r requirements.txt \
 && pip uninstall -y triton

# Usuário sem root criado antes de baixar o modelo: evita um chown que duplicaria a camada.
RUN useradd --create-home transcribe && mkdir -p /app/models && chown transcribe /app /app/models
USER transcribe

# Baixa o modelo na construção da imagem: o contêiner sobe sem depender da internet.
ARG WHISPER_MODEL=small
ENV WHISPER_MODEL=${WHISPER_MODEL} HF_HOME=/app/models
RUN python -c "import whisperx; whisperx.load_model('${WHISPER_MODEL}', device='cpu', compute_type='int8', language='pt')"

COPY --chown=transcribe app.py bench.py ./
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=120s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1
CMD ["python", "app.py"]
