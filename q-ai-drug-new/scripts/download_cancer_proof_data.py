from __future__ import annotations

import sys

from q_ai_drug.cli import main


if __name__ == "__main__":
    main(["download-data", *sys.argv[1:]])
