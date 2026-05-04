#!/usr/bin/env python3
# Run from repo root:
#   python3 process_data/features/regenerate_silhouette_features_from_objects.py
from __future__ import annotations

import csv
import json
from pathlib import Path

try:
    from .get_features import (
        DEFAULT_ALPHA_THRESHOLD,
        DEFAULT_NUM_SAMPLES,
        MASK_GLOB,
        extract_features_for_mask,
        extract_object_id,
        get_feature_fieldnames,
    )
except ImportError:
    from get_features import (
        DEFAULT_ALPHA_THRESHOLD,
        DEFAULT_NUM_SAMPLES,
        MASK_GLOB,
        extract_features_for_mask,
        extract_object_id,
        get_feature_fieldnames,
    )

REPO_ROOT = Path(__file__).resolve().parents[2]
OBJECTS_JSON = REPO_ROOT / "fetch_data/data/objects.json"
MASK_DIR = REPO_ROOT / "process_data/generated/real_images"
OUT_CSV = REPO_ROOT / "process_data/features/silhouette_features.csv"
SKIPPED_JSONL = REPO_ROOT / "process_data/features/skipped_features.jsonl"

N_SAMPLES = DEFAULT_NUM_SAMPLES
ALPHA_THRESHOLD = DEFAULT_ALPHA_THRESHOLD


def load_object_ids(path: Path) -> set[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("objects.json must be a dict keyed by object id")

    ids: set[str] = set()
    for key, value in data.items():
        if isinstance(value, dict) and value.get("objectID") is not None:
            ids.add(str(value["objectID"]))
        else:
            ids.add(str(key))
    return ids


def main() -> None:
    object_ids = load_object_ids(OBJECTS_JSON)

    mask_paths = sorted(MASK_DIR.glob(MASK_GLOB))
    selected_masks = [p for p in mask_paths if extract_object_id(p) in object_ids]

    rows = []
    skipped = []

    for mask_path in selected_masks:
        oid = extract_object_id(mask_path)
        try:
            row = extract_features_for_mask(
                mask_path=mask_path,
                n_samples=N_SAMPLES,
                alpha_threshold=ALPHA_THRESHOLD,
            )
            rows.append(row)
        except Exception as exc:
            skipped.append(
                {
                    "object_id": oid,
                    "file": mask_path.name,
                    "error": str(exc),
                }
            )

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = get_feature_fieldnames(n_samples=N_SAMPLES)
    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    SKIPPED_JSONL.parent.mkdir(parents=True, exist_ok=True)
    with SKIPPED_JSONL.open("w", encoding="utf-8") as f:
        for item in skipped:
            f.write(json.dumps(item) + "\n")

    extracted_ids = {str(r["object_id"]) for r in rows}
    mask_ids = {extract_object_id(p) for p in selected_masks}

    print("Done.")
    print(f"objects.json ids: {len(object_ids)}")
    print(f"mask files total: {len(mask_paths)}")
    print(f"mask files matching objects.json: {len(selected_masks)}")
    print(f"rows written: {len(rows)}")
    print(f"skipped: {len(skipped)}")
    print(f"objects with no matching mask: {len(object_ids - mask_ids)}")
    print(f"rows not in objects.json (should be 0): {len(extracted_ids - object_ids)}")


if __name__ == "__main__":
    main()
