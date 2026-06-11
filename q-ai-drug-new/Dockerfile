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

RUN python -m pip install --upgrade pip \
    && python -m pip install -e ".[research]"

EXPOSE 8000

CMD ["python", "scripts/start_api.py"]
