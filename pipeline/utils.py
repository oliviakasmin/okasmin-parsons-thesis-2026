"""Utility helpers for the pipeline package."""

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OBJECTS_PATH = ROOT / "pipeline" / "data" / "objects.json"


def get_object_count(data: Any) -> int:
    if isinstance(data, dict):
        return len(data)
    if isinstance(data, list):
        return len(data)
    return 0


def count_objects() -> None:
    """Print how many objects are currently saved in objects.json."""
    if not OBJECTS_PATH.exists() or OBJECTS_PATH.stat().st_size == 0:
        print(f"objects saved: 0 ({OBJECTS_PATH} missing or empty)")
        return

    with OBJECTS_PATH.open("r", encoding="utf-8") as file:
        data = json.load(file)

    print(f"objects saved: {get_object_count(data)}")


def main() -> None:
    count_objects()


if __name__ == "__main__":
    main()
