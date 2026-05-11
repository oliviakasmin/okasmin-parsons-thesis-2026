# Run from repo root:
#   python format_data/use_groups/get_use.py

from __future__ import annotations

import csv
import importlib.util
from pathlib import Path

_DIR = Path(__file__).resolve().parent
_MAPPING_PATH = _DIR / "use_mapping.py"
TITLE_COLS_PATH = _DIR / "title_cols.csv"

# Label when no mapping keyword matches.
FALLBACK_USE = "other"

# Category priority: same top-to-bottom order as assignments in use_mapping.py.
# First matching category wins (e.g. ANIMAL_SHAPED before VASE when both match).
USE_GROUP_ORDER = [
    "ANIMAL_SHAPED",
    "WINE_ALCOHOL_WATER",
    "RITUAL",
    "POURING",
    "FLASK_AND_BOTTLE",
    "STORAGE",
    "VASE",
]


def _load_mapping_module():
    spec = importlib.util.spec_from_file_location("use_mapping", _MAPPING_PATH)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def _use_label(const_name: str) -> str:
    return const_name.lower()


def classify_title(title: str, mod) -> str:
    t = title.lower()
    for group in USE_GROUP_ORDER:
        for needle in getattr(mod, group):
            if needle.lower() in t:
                return _use_label(group)
    return FALLBACK_USE


def main() -> None:
    mod = _load_mapping_module()

    with TITLE_COLS_PATH.open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    if not rows:
        raise SystemExit("title_cols.csv has no data rows")

    fieldnames = list(rows[0].keys())
    if "use" not in fieldnames:
        fieldnames.append("use")

    for row in rows:
        title = row.get("title") or ""
        row["use"] = classify_title(title, mod)

    with TITLE_COLS_PATH.open("w", encoding="utf-8", newline="") as out:
        w = csv.DictWriter(out, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


if __name__ == "__main__":
    main()
