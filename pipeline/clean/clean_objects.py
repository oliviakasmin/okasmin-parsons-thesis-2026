# RUN THIS FILE FROM ROOT DIRECTORY
# python -m pipeline.clean.clean_objects


# remove any objects in objects.json that appear in pipeline/data/manual_reject_object_ids.json


# remove any objects in objects.json that appear in reject_object_ids


# if any objects have primaryImage or primaryImageSmall that matches another object then add all of the corresponding objectIds to reject_object_ids and remove those objects from objects.json


# run apply_filters on objects.json to remove any from earlier fetches that got through


import json
from pathlib import Path
from typing import Any, Dict

from pipeline.fetch.filter_objects import apply_filters

# Paths
ROOT = Path(__file__).resolve().parents[2]  # .../okasmin-parsons-thesis-2026
DATA_DIR = ROOT / "pipeline" / "data"
OBJECTS_PATH = DATA_DIR / "objects.json"
REJECT_IDS_PATH = DATA_DIR / "reject_object_ids.json"


def load_json_dict(path: Path) -> Dict[str, Any]:
    if not path.exists() or path.stat().st_size == 0:
        return {}
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_json_list(path: Path) -> list[int]:
    if not path.exists() or path.stat().st_size == 0:
        return []
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: Any) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def clean_objects_with_filters() -> None:
    """
    Run apply_filters on all existing objects in objects.json and
    remove any that now fail the filters, adding their IDs to reject_object_ids.json.
    """
    objects_by_id: Dict[str, Any] = load_json_dict(OBJECTS_PATH)
    rejected_ids: list[int] = load_json_list(REJECT_IDS_PATH)

    original_count = len(objects_by_id)
    removed_count = 0

    # We build a new dict of kept objects
    cleaned_objects: Dict[str, Any] = {}

    for key, obj in objects_by_id.items():
        # objectID in the JSON is an int; keys in objects_by_id are strings
        object_id = int(obj.get("objectID", key))
        if apply_filters(obj, object_id, rejected_ids):
            cleaned_objects[key] = obj
        else:
            removed_count += 1

    save_json(OBJECTS_PATH, cleaned_objects)
    save_json(REJECT_IDS_PATH, rejected_ids)

    print(
        f"Cleaned objects.json with filters: {original_count} -> {len(cleaned_objects)} "
        f"(removed {removed_count} objects that failed filters)"
    )

def remove_empty_string_fields_from_object(obj: Dict[str, Any]) -> Dict[str, Any]:
    """
    Return a new object dict with any top-level fields removed when value == "".
    Keeps all other values (including 0, False, [], {}, and None).
    """
    return {k: v for k, v in obj.items() if v != ""}

def clean_empty_string_fields() -> None:
    """
    Remove top-level fields with empty-string values from every object in objects.json.
    """
    objects_by_id: Dict[str, Any] = load_json_dict(OBJECTS_PATH)

    original_object_count = len(objects_by_id)
    removed_field_count = 0

    cleaned_objects: Dict[str, Any] = {}
    for key, obj in objects_by_id.items():
        cleaned_obj = remove_empty_string_fields_from_object(obj)
        removed_field_count += len(obj) - len(cleaned_obj)
        cleaned_objects[key] = cleaned_obj

    save_json(OBJECTS_PATH, cleaned_objects)

    print(
        f"Removed {removed_field_count} empty-string fields across "
        f"{original_object_count} objects."
    )

def run_all() -> None:
    """
    Entry point for cleaning steps.
    """
    clean_objects_with_filters()
    clean_empty_string_fields() # run after cleaning with filters to remove any fields that are now empty


if __name__ == "__main__":
    run_all()