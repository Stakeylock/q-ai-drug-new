FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV QAI_OUTPUT_DIR=/app/outputs/cancer_proof_v1
ENV QAI_MODELS_DIR=/app/models
ENV APP_ENV=local

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential cmake curl git libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY src ./src
COPY configs ./configs
COPY frontend ./frontend
COPY scripts ./scripts
COPY migrations ./migrations
COPY alembic.ini ./alembic.ini
COPY data ./data
COPY models ./models

RUN python -m pip install --upgrade "pip>=26.1.2" "setuptools>=78.1.1" "wheel>=0.46.2" \
    && python -m pip install -e ".[research]"

RUN addgroup --system app && adduser --system --ingroup app app \
    && mkdir -p /app/outputs /app/data /app/models \
    && chown -R app:app /app/outputs

EXPOSE 8000

USER app

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)" || exit 1

CMD ["python", "scripts/start_api.py"]
