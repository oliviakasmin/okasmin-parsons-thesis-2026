#!/usr/bin/env python3
"""
Build "interesting matches" per object based on top-K silhouette similarity candidates.

For each input object ID, compute top-K nearest shapes and choose:
1) closest_shape
2) furthest_date (within top-K)
3) closest_different_culture (within top-K)
4) closest_different_department (within top-K)

Undefined date/culture/department values do not count as "different".
If no valid match exists for a criterion, return null for that criterion.
"""

import argparse
import csv
import json
import math
import re
from pathlib import Path

DEFAULT_FEATURES_CSV = "hf_space/pipeline/features/test_silhouette_features.csv"
DEFAULT_OBJECTS_JSON = "pipeline/data/objects.json"
DEFAULT_MANUAL_REJECT_JSON = "pipeline/data/manual_reject_object_ids.json"
DEFAULT_OUTPUT_JSON = "test_assets/most_interesting_matches.json"
DEFAULT_TOP_K = 20
MISSING_ROW_PENALTY = 1.0


def parse_args():
    parser = argparse.ArgumentParser(description="Build interesting silhouette matches for frontend modal.")
    parser.add_argument(
        "--features-csv",
        default=DEFAULT_FEATURES_CSV,
        help=f"Path to silhouette feature CSV (default: {DEFAULT_FEATURES_CSV}).",
    )
    parser.add_argument(
        "--objects-json",
        default=DEFAULT_OBJECTS_JSON,
        help=f"Path to objects JSON with date/culture/department metadata (default: {DEFAULT_OBJECTS_JSON}).",
    )
    parser.add_argument(
        "--manual-reject-json",
        default=DEFAULT_MANUAL_REJECT_JSON,
        help=f"Path to manual reject ID list (default: {DEFAULT_MANUAL_REJECT_JSON}).",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=DEFAULT_TOP_K,
        help=f"Number of nearest candidates considered per object (default: {DEFAULT_TOP_K}).",
    )
    parser.add_argument(
        "--output-json",
        default=DEFAULT_OUTPUT_JSON,
        help=f"Output JSON path for frontend use (default: {DEFAULT_OUTPUT_JSON}).",
    )
    return parser.parse_args()


def is_number(value):
    try:
        float(value)
        return True
    except (TypeError, ValueError):
        return False


def parse_feature_value(value):
    if value is None:
        return math.nan
    text = str(value).strip()
    if text == "" or text.lower() == "nan":
        return math.nan
    return float(text)


def load_feature_rows(features_csv_path):
    with features_csv_path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        if reader.fieldnames is None:
            raise ValueError(f"Missing header in CSV: {features_csv_path}")

        feature_columns = [
            col
            for col in reader.fieldnames
            if (col.startswith("l") or col.startswith("r")) and is_number(col[1:])
        ]
        if not feature_columns:
            raise ValueError("No silhouette feature columns found (expected l1..lN and r1..rN).")

        rows = []
        for row in reader:
            object_id = str(row.get("object_id", "")).strip()
            if not object_id:
                continue
            vector = [parse_feature_value(row.get(col)) for col in feature_columns]
            rows.append({"object_id": object_id, "vector": vector})
    return rows


def load_objects_index(objects_json_path):
    with objects_json_path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    index = {}
    if isinstance(data, dict):
        for key, value in data.items():
            if not isinstance(value, dict):
                continue
            object_id = str(value.get("objectID", key)).strip()
            index[object_id] = value
    elif isinstance(data, list):
        for value in data:
            if not isinstance(value, dict):
                continue
            object_id = str(value.get("objectID", "")).strip()
            if object_id:
                index[object_id] = value
    else:
        raise ValueError("Unsupported objects JSON format.")
    return index


def load_manual_reject_ids(manual_reject_json_path):
    if not manual_reject_json_path.exists():
        return set()
    data = json.loads(manual_reject_json_path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"Expected reject list JSON array at {manual_reject_json_path}.")
    return {str(item).strip() for item in data if str(item).strip()}


def full_profile_distance(a, b):
    """
    Strict full-profile distance across all sampled rows.

    - finite vs finite: squared difference
    - finite vs nan (or nan vs finite): fixed penalty
    - nan vs nan: no penalty
    """
    sum_sq = 0.0
    overlap = 0
    mismatched_rows = 0
    for av, bv in zip(a, b):
        a_nan = math.isnan(av)
        b_nan = math.isnan(bv)
        if not a_nan and not b_nan:
            diff = av - bv
            sum_sq += diff * diff
            overlap += 1
            continue
        if a_nan and b_nan:
            continue
        sum_sq += MISSING_ROW_PENALTY * MISSING_ROW_PENALTY
        mismatched_rows += 1
    return math.sqrt(sum_sq), overlap, mismatched_rows


def normalized_text(value):
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return None
    if text.lower() in {"unknown", "none", "null", "n/a", "na", "unidentified", "undated"}:
        return None
    return text


def parse_year_from_object_date(text):
    cleaned = normalized_text(text)
    if cleaned is None:
        return None
    lower = cleaned.lower().replace("–", "-").replace("—", "-")
    is_bce = "bce" in lower or "bc" in lower

    century_match = re.search(r"(\d+)\s*(st|nd|rd|th)\s*century", lower)
    if century_match:
        century = int(century_match.group(1))
        if is_bce:
            return -((century - 1) * 100 + 50)
        return (century - 1) * 100 + 50

    numbers = [int(n) for n in re.findall(r"\d{1,4}", lower)]
    if not numbers:
        return None

    # Use first plausible year token.
    year = numbers[0]
    if is_bce:
        year = -year
    return year


def get_meta(objects_index, object_id):
    obj = objects_index.get(object_id, {})
    return {
        "objectDate": normalized_text(obj.get("objectDate")),
        "department": normalized_text(obj.get("department")),
        "culture": normalized_text(obj.get("culture")),
    }


def pick_furthest_date(query_year, candidates, objects_index, excluded_ids):
    if query_year is None:
        return None
    best = None
    best_delta = -1
    for candidate in candidates:
        object_id = candidate["object_id"]
        if object_id in excluded_ids:
            continue
        year = parse_year_from_object_date(get_meta(objects_index, object_id)["objectDate"])
        if year is None:
            continue
        delta = abs(year - query_year)
        if delta > best_delta:
            best_delta = delta
            best = object_id
    return best


def pick_closest_different_field(query_value, field_name, candidates, objects_index, excluded_ids):
    if query_value is None:
        return None
    for candidate in candidates:
        object_id = candidate["object_id"]
        if object_id in excluded_ids:
            continue
        candidate_value = get_meta(objects_index, object_id)[field_name]
        if candidate_value is None:
            continue
        if candidate_value != query_value:
            return object_id
    return None


def build_interesting_matches(rows, objects_index, top_k):
    results = {}
    for query in rows:
        query_id = query["object_id"]

        scored = []
        for candidate in rows:
            if candidate["object_id"] == query_id:
                continue
            distance, overlap, mismatched_rows = full_profile_distance(
                query["vector"], candidate["vector"]
            )
            scored.append(
                {
                    "object_id": candidate["object_id"],
                    "distance": distance,
                    "overlap_dims": overlap,
                    "mismatched_rows": mismatched_rows,
                }
            )
        scored.sort(key=lambda row: row["distance"])
        top_candidates = scored[:top_k]

        closest_shape = top_candidates[0]["object_id"] if top_candidates else None
        used = {closest_shape} if closest_shape else set()

        query_meta = get_meta(objects_index, query_id)
        query_year = parse_year_from_object_date(query_meta["objectDate"])

        furthest_date = pick_furthest_date(
            query_year=query_year,
            candidates=top_candidates,
            objects_index=objects_index,
            excluded_ids=used,
        )
        if furthest_date:
            used.add(furthest_date)

        closest_different_culture = pick_closest_different_field(
            query_value=query_meta["culture"],
            field_name="culture",
            candidates=top_candidates,
            objects_index=objects_index,
            excluded_ids=used,
        )
        if closest_different_culture:
            used.add(closest_different_culture)

        closest_different_department = pick_closest_different_field(
            query_value=query_meta["department"],
            field_name="department",
            candidates=top_candidates,
            objects_index=objects_index,
            excluded_ids=used,
        )

        results[query_id] = {
            "closest_shape": closest_shape,
            "furthest_date": furthest_date,
            "closest_different_culture": closest_different_culture,
            "closest_different_department": closest_different_department,
        }
    return results


def main():
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[2]
    features_csv_path = repo_root / args.features_csv
    objects_json_path = repo_root / args.objects_json
    manual_reject_json_path = repo_root / args.manual_reject_json
    output_json_path = repo_root / args.output_json

    rows = load_feature_rows(features_csv_path)
    objects_index = load_objects_index(objects_json_path)
    reject_ids = load_manual_reject_ids(manual_reject_json_path)
    rows = [row for row in rows if row["object_id"] not in reject_ids]

    results = build_interesting_matches(rows=rows, objects_index=objects_index, top_k=args.top_k)

    payload = {
        "top_k_candidates": args.top_k,
        "criteria_order": [
            "closest_shape",
            "furthest_date",
            "closest_different_culture",
            "closest_different_department",
        ],
        "results": results,
    }

    output_json_path.parent.mkdir(parents=True, exist_ok=True)
    output_json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print(f"rows_considered={len(rows)}")
    print(f"results_written={len(results)}")
    print(f"output={output_json_path}")


if __name__ == "__main__":
    main()
