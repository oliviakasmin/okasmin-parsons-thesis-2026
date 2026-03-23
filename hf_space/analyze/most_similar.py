#!/usr/bin/env python3
"""
Given an object ID in the silhouette feature CSV, return the most similar object ID.

Usage:
  python hf_space/analyze/most_similar.py --object-id 44793
  python hf_space/analyze/most_similar.py --object-id 44793 --verbose
"""

import argparse
import csv
import math
from pathlib import Path

DEFAULT_FEATURES_CSV = "hf_space/pipeline/features/test_silhouette_features.csv"
MISSING_ROW_PENALTY = 1.0


def parse_args():
    parser = argparse.ArgumentParser(
        description="Find the most similar silhouette for a given object ID."
    )
    parser.add_argument("--object-id", required=True, help="Object ID to query.")
    parser.add_argument(
        "--features-csv",
        default=DEFAULT_FEATURES_CSV,
        help=f"Path to silhouette features CSV (default: {DEFAULT_FEATURES_CSV}).",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print distance and overlap diagnostics in addition to the ID.",
    )
    return parser.parse_args()


def is_number(value):
    try:
        float(value)
        return True
    except (TypeError, ValueError):
        return False


def parse_feature_value(value):
    # CSV uses "nan" for missing rows; keep as math.nan so we can ignore per-dimension.
    if value is None:
        return math.nan
    text = str(value).strip()
    if text == "" or text.lower() == "nan":
        return math.nan
    return float(text)


def load_feature_table(features_csv_path):
    with features_csv_path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        if reader.fieldnames is None:
            raise ValueError(f"Missing header in CSV: {features_csv_path}")

        feature_columns = [
            col for col in reader.fieldnames if (col.startswith("l") or col.startswith("r")) and is_number(col[1:])
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


def find_most_similar(object_id, rows):
    query = None
    for row in rows:
        if row["object_id"] == object_id:
            query = row
            break
    if query is None:
        raise ValueError(f"Object ID {object_id} not found in feature CSV.")

    best_row = None
    best_distance = math.inf
    best_overlap = 0
    best_mismatched_rows = 0

    for candidate in rows:
        if candidate["object_id"] == object_id:
            continue
        distance, overlap, mismatched_rows = full_profile_distance(
            query["vector"], candidate["vector"]
        )
        if distance < best_distance:
            best_distance = distance
            best_overlap = overlap
            best_mismatched_rows = mismatched_rows
            best_row = candidate

    if best_row is None or not math.isfinite(best_distance):
        raise ValueError(
            "No comparable object found."
        )

    return best_row["object_id"], best_distance, best_overlap, best_mismatched_rows


def main():
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[2]
    features_csv_path = repo_root / args.features_csv
    rows = load_feature_table(features_csv_path)

    best_object_id, distance, overlap, mismatched_rows = find_most_similar(
        str(args.object_id), rows
    )

    # Keep default output minimal for piping into other scripts.
    print(best_object_id)
    if args.verbose:
        print(
            f"query={args.object_id} best_match={best_object_id} "
            f"distance={distance:.6f} overlap_dims={overlap} mismatched_rows={mismatched_rows}"
        )


if __name__ == "__main__":
    main()
