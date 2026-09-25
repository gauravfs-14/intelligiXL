# syntax=docker/dockerfile:1
#
# Self-hosted Laya System One engine (https://github.com/NandhaKishorM/laya),
# served by `laya-serve` (FastAPI/uvicorn). CPU-only torch keeps the image
# portable (amd64 + arm64); models download lazily into $HF_HOME on first use.
FROM python:3.12-slim

ARG LAYA_VERSION=
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/models \
    HF_HUB_DISABLE_TELEMETRY=1 \
    LAYA_HOST=0.0.0.0 \
    LAYA_PORT=8000 \
    LAYA_DEVICE=cpu \
    LAYA_PRELOAD=0

RUN pip install --index-url https://download.pytorch.org/whl/cpu torch \
 && pip install "laya[serve]${LAYA_VERSION:+==$LAYA_VERSION}"

RUN useradd --create-home --uid 1000 laya \
 && mkdir -p /models && chown laya:laya /models
VOLUME ["/models"]
USER laya
WORKDIR /home/laya

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/health' % os.environ.get('LAYA_PORT','8000'), timeout=4)" || exit 1
CMD ["laya-serve"]
