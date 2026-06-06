from __future__ import annotations

import os
import subprocess
import sys

import uvicorn


def main() -> None:
    if os.getenv("QAI_RUN_MIGRATIONS", "1").strip().lower() in {"1", "true", "yes"}:
        subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)
    uvicorn.run("q_ai_drug.service.main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))


if __name__ == "__main__":
    main()
