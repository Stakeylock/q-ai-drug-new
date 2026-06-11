from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from q_ai_drug.tools.external import write_external_tool_manifest


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Verify Vina/Smina/GNINA/OpenBabel/xTB discovery through Windows PATH or WSL.")
    parser.add_argument("--output", default=str(Path("outputs") / "external_tools_manifest.json"))
    parser.add_argument("--required", nargs="*", default=["vina", "smina", "gnina", "obabel", "xtb"])
    parser.add_argument("--strict", action="store_true", help="Exit non-zero if any required tool is unavailable.")
    args = parser.parse_args(argv)

    manifest = write_external_tool_manifest(args.output)
    print(json.dumps(manifest, indent=2))
    missing = [name for name in args.required if not manifest.get(name, {}).get("available")]
    if missing:
        print(f"Missing required external tools: {', '.join(missing)}", file=sys.stderr)
        if args.strict:
            raise SystemExit(2)


if __name__ == "__main__":
    main()
