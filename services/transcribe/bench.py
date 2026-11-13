"""Mede a latência da transcrição no CPU (roadmap T2.8: medir antes de fechar).

Uso no contêiner: python bench.py /amostras/*.wav
Mostra o tempo de carga do modelo e, por amostra, a duração do áudio, o tempo de transcrição
e o fator de tempo real (tempo gasto / duração do áudio).
"""

import os
import sys
import time

from app import SAMPLE_RATE, WhisperXEngine


def main(paths: list[str]) -> None:
    model = os.environ.get("WHISPER_MODEL", "small")
    threads = int(os.environ.get("WHISPER_THREADS", "0")) or (os.cpu_count() or 2)
    started = time.perf_counter()
    engine = WhisperXEngine(model=model, compute_type="int8", language="pt", threads=threads)
    print(f"modelo {model}, {threads} threads, carga em {time.perf_counter() - started:.1f} s")
    for path in paths:
        audio = engine.load(path)
        duration = len(audio) / SAMPLE_RATE
        started = time.perf_counter()
        text = engine.transcribe(audio)
        elapsed = time.perf_counter() - started
        print(f"{os.path.basename(path)}: {duration:.1f} s de áudio em {elapsed:.1f} s "
              f"(x{elapsed / duration:.2f}) → {text[:90]}")


if __name__ == "__main__":
    main(sys.argv[1:])
