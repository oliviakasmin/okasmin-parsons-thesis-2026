# RUN THIS FILE FROM ROOT DIRECTORY
#   python -m pipeline.clean.clean_object_ids

# remove object IDs from objects_ids.json if they appear in the reject_object_ids.json

import json
from pathlib import Path

# Paths
ROOT = Path(__file__).resolve().parents[2]  # .../okasmin-parsons-thesis-2026
DATA_DIR = ROOT / "pipeline" / "data"
OBJECT_IDS_PATH = DATA_DIR / "object_ids.json"
REJECT_IDS_PATH = DATA_DIR / "reject_object_ids.json"


def load_json_list(path: Path) -> list[int]:
    if not path.exists() or path.stat().st_size == 0:
        return []
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json_list(path: Path, data: list[int]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def main() -> None:
    object_ids = load_json_list(OBJECT_IDS_PATH)
    reject_ids = set(load_json_list(REJECT_IDS_PATH))

    original_count = len(object_ids)
    cleaned_ids = [oid for oid in object_ids if oid not in reject_ids]
    cleaned_count = len(cleaned_ids)

    save_json_list(OBJECT_IDS_PATH, cleaned_ids)

    print(
        f"Cleaned object_ids.json: {original_count} -> {cleaned_count} "
        f"(removed {original_count - cleaned_count} IDs present in reject_object_ids.json)"
    )


if __name__ == "__main__":
    main()
