from __future__ import annotations

from typing import Any

from redis import Redis
from rq import Queue

from q_ai_drug.service.settings import get_settings


QUEUE_NAMES = [
    "default",
    "data",
    "structure",
    "scoring",
    "training",
    "generation",
    "docking",
    "gnina",
    "md",
    "qm",
    "qml",
    "ranking",
    "decision",
    "visual",
    "collaboration",
    "reporting",
]


def redis_connection() -> Redis:
    return Redis.from_url(get_settings().redis_url)


def get_queue(name: str = "default") -> Queue:
    if name not in QUEUE_NAMES:
        raise ValueError(f"Unknown queue: {name}")
    return Queue(name, connection=redis_connection())


def queue_enabled() -> bool:
    return get_settings().use_queue


def enqueue_cancer_proof_run(job_id: str, payload: dict[str, Any]) -> str:
    job = get_queue("default").enqueue(
        "q_ai_drug.service.tasks.run_cancer_proof_task",
        job_id,
        payload,
        job_timeout=get_settings().max_job_runtime,
        result_ttl=86400,
        failure_ttl=604800,
    )
    return str(job.id)


def enqueue_module_task(queue_name: str, job_id: str, payload: dict[str, Any], *, priority: str | None = None) -> str:
    job = get_queue(queue_name).enqueue(
        "q_ai_drug.service.tasks.run_module_task",
        job_id,
        payload,
        at_front=priority == "high",
        job_timeout=get_settings().max_job_runtime,
        result_ttl=86400,
        failure_ttl=604800,
    )
    return str(job.id)
