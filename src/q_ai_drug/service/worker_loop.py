from __future__ import annotations

import argparse

from rq import Worker

from q_ai_drug.service.db import init_database
from q_ai_drug.service.queue import QUEUE_NAMES, get_queue, redis_connection


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run real Redis/RQ workers for Q-AI research queues.")
    parser.add_argument("--queue", action="append", choices=QUEUE_NAMES, help="Queue to consume. Repeat for multiple queues.")
    args = parser.parse_args(argv)
    queue_names = args.queue or ["default"]
    init_database()
    connection = redis_connection()
    queues = [get_queue(name) for name in queue_names]
    worker = Worker(queues, connection=connection)
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
