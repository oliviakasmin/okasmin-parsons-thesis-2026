# Run from repo root:
#   python format_data/use_groups/get_title_cols.py

from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OBJECTS_JSON_PATH = ROOT / "fetch_data" / "data" / "objects.json"
OUTPUT_CSV_PATH = Path(__file__).resolve().parent / "title_cols.csv"


def main() -> None:
    with OBJECTS_JSON_PATH.open("r", encoding="utf-8") as f:
        raw: dict[str, dict] = json.load(f)

    rows: list[tuple[int, str]] = []
    for obj in raw.values():
        oid = obj.get("objectID")
        if oid is None:
            continue
        title = obj.get("title")
        rows.append((int(oid), "" if title is None else str(title)))

    rows.sort(key=lambda r: r[0])

    with OUTPUT_CSV_PATH.open("w", encoding="utf-8", newline="") as out:
        w = csv.writer(out)
        w.writerow(["objectID", "title"])
        w.writerows(rows)


if __name__ == "__main__":
    main()
