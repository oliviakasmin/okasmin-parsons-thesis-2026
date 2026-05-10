#!/usr/bin/env python3
"""
Precompute shape-similar neighbors (mirrors app neighbor consumption in Test2 / ObjectImageModal).

Reads process_data/features/silhouette_features.csv and format_data/generated/fields.csv.
Writes top 20 neighbors per object plus `neighborsModal7` chosen from that pool with geo +
chronology tiers (≥1000 yr gap, then ≥500, else plain top 7).

Outputs format_data/generated/shape_neighbors_<metric>.json

Usage:
  python3 format_data/compute_shape_neighbors.py --metric euclidean
  python3 format_data/compute_shape_neighbors.py --metric cosine
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from collections.abc import Callable
from itertools import combinations
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent

TOP_SHAPE_NEIGHBORS_K = 20
SILHOUETTE_PATH = REPO_ROOT / "process_data" / "features" / "silhouette_features.csv"
FIELDS_PATH = REPO_ROOT / "format_data" / "generated" / "fields.csv"
OUT_DIR = REPO_ROOT / "format_data" / "generated"

FEATURE_WEIGHTS = {
    "lr": 1.0,
    "tb": 0.2,
    "shape": 1.0,
    "inner": 0.8,
    "innerCount": 0.5,
}

COUNTRY_PREFIXES_TO_STRIP = [
    "eastern ",
    "western ",
    "northeast ",
    "northwest ",
    "southeast ",
    "southwest ",
    "east ",
    "west ",
    "north ",
    "south ",
    "byzantine ",
]


def numeric_suffix(name: str, prefix: str) -> float:
    if not name.startswith(prefix):
        return float("nan")
    suf = name[len(prefix) :]
    return float(suf) if suf.isdigit() else float("nan")


def sorted_profile_cols(headers: list[str], pfx: str) -> list[str]:
    cols = [h for h in headers if math.isfinite(numeric_suffix(h, pfx))]
    return sorted(cols, key=lambda h: numeric_suffix(h, pfx))


def median(vals: list[float]) -> float:
    if not vals:
        return 0.0
    s = sorted(vals)
    m = len(s) // 2
    return float(s[m]) if len(s) % 2 else (s[m - 1] + s[m]) / 2.0


def normalize_country_candidate(value: str) -> str:
    t = value.strip().lower()
    if not t:
        return ""
    parts = [p.strip() for p in t.split(",") if p.strip()]
    if not parts:
        return ""
    t = parts[-1]
    for prefix in COUNTRY_PREFIXES_TO_STRIP:
        if t.startswith(prefix):
            t = t[len(prefix) :].strip()
            break
    if t == "türkiye":
        return "turkey"
    if t == "britain":
        return "united kingdom"
    if t == "korea":
        return "south korea"
    return t


def country_for_fields_row(row: dict[str, str]) -> str | None:
    status = (row.get("geo_mapbox_match_status") or "").strip()
    if status == "no_match":
        return None
    place = (row.get("mapbox_place_name") or "").strip()
    norm_loc = (row.get("geo_normalized_best_guess_location") or "").strip()
    for cand in (place, norm_loc):
        n = normalize_country_candidate(cand)
        if n:
            return n
    return None


def parse_int_year_final_date(cell: str) -> int | None:
    t = cell.strip()
    if not t:
        return None
    if t.lstrip("-").isdigit():
        return int(t)
    return None


def parse_int_cell(cell: str) -> int | None:
    t = cell.strip()
    if not t:
        return None
    try:
        v = int(float(t))
        return v
    except ValueError:
        return None


def load_fields_maps(path: Path) -> tuple[dict[str, dict[str, str]], int | None, int | None]:
    """object_id -> full row dict; corpus min(objectBeginDate), max(objectEndDate)."""
    by_id: dict[str, dict[str, str]] = {}
    begins: list[int] = []
    ends: list[int] = []
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            oid = (row.get("objectId") or "").strip()
            if not oid:
                continue
            by_id[oid] = row
            ob = parse_int_cell(row.get("objectBeginDate") or "")
            oe = parse_int_cell(row.get("objectEndDate") or "")
            if ob is not None:
                begins.append(ob)
            if oe is not None:
                ends.append(oe)
    y_min = min(begins) if begins else None
    y_max = max(ends) if ends else None
    return by_id, y_min, y_max


def build_feature_matrix(
    silhouette_path: Path,
    allowed_ids: set[str],
) -> tuple[list[str], dict[str, list[float]], list[str]]:
    """Returns ordered_ids (CSV row order), vectors dict, feature_col names."""
    with silhouette_path.open(newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        headers = next(reader)
    col_index = {h: i for i, h in enumerate(headers)}
    if "object_id" not in col_index:
        return [], {}, []

    lr_cols = sorted_profile_cols(headers, "l") + sorted_profile_cols(headers, "r")
    tb_cols = sorted_profile_cols(headers, "t") + sorted_profile_cols(headers, "b")
    symmetry_cols = [
        c
        for c in headers
        if c
        in (
            "lr_profile_abs_diff_mean",
            "eccentricity",
            "upper_vs_lower_width_ratio",
            "centroid_x_norm",
            "centroid_offset_x",
        )
    ]
    contour_cols = [c for c in headers if c.startswith("contour_") or c.startswith("convexity_")]
    hu_cols = [c for c in headers if len(c) > 2 and c.startswith("hu") and c[2:].isdigit()]
    inner_count_cols = [c for c in headers if c == "inner_count"]
    inner_cols = [c for c in headers if c.startswith("inner") and c != "inner_count"]
    shape_cols = list(dict.fromkeys(contour_cols + hu_cols + symmetry_cols))

    feature_cols_all = lr_cols + tb_cols + shape_cols + inner_cols + inner_count_cols
    feature_cols = [c for c in feature_cols_all if c in col_index]
    feature_indices = [col_index[c] for c in feature_cols]

    rows: list[tuple[str, list[float]]] = []
    values_by_col: list[list[float]] = [[] for _ in feature_indices]

    with silhouette_path.open(newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader)
        for raw_cells in reader:
            if len(raw_cells) <= col_index["object_id"]:
                continue
            oid = raw_cells[col_index["object_id"]].strip()
            if not oid or oid not in allowed_ids:
                continue
            vals: list[float] = []
            for j, idx in enumerate(feature_indices):
                cell = raw_cells[idx].strip().lower() if idx < len(raw_cells) else ""
                if cell == "" or cell == "nan":
                    parsed = float("nan")
                else:
                    try:
                        parsed = float(cell)
                    except ValueError:
                        parsed = float("nan")
                if math.isfinite(parsed):
                    values_by_col[j].append(parsed)
                vals.append(parsed)
            rows.append((oid, vals))

    if not rows:
        return [], {}, []

    medians = [median(vs) for vs in values_by_col]
    imputed = [
        [v if math.isfinite(v) else medians[i] for i, v in enumerate(vals)] for oid, vals in rows
    ]

    nrows = len(imputed)
    nfeat = len(feature_indices)
    means = []
    for j in range(nfeat):
        s = sum(imputed[i][j] for i in range(nrows))
        means.append(s / max(1, nrows))
    stds = []
    for j in range(nfeat):
        var = sum((imputed[i][j] - means[j]) ** 2 for i in range(nrows)) / max(1, nrows)
        stds.append(math.sqrt(var) if var > 0 else 1.0)

    weights: list[float] = []
    for col in feature_cols:
        if col in lr_cols:
            weights.append(FEATURE_WEIGHTS["lr"])
        elif col in tb_cols:
            weights.append(FEATURE_WEIGHTS["tb"])
        elif col == "inner_count":
            weights.append(FEATURE_WEIGHTS["innerCount"])
        elif col in inner_cols:
            weights.append(FEATURE_WEIGHTS["inner"])
        else:
            weights.append(FEATURE_WEIGHTS["shape"])

    vectors: dict[str, list[float]] = {}
    ordered_ids: list[str] = []
    for i, (oid, _) in enumerate(rows):
        vec = []
        for j in range(nfeat):
            z = (imputed[i][j] - means[j]) / stds[j]
            vec.append(z * weights[j])
        vectors[oid] = vec
        ordered_ids.append(oid)

    return ordered_ids, vectors, feature_cols


def pairwise_distance_matrix(X: np.ndarray, metric: str) -> np.ndarray:
    """X shape (n, d). Returns (n, n) distances; diagonal should be ignored."""
    if metric == "euclidean":
        xx = np.sum(X * X, axis=1, keepdims=True)
        d2 = np.maximum(xx + xx.T - 2.0 * (X @ X.T), 0.0)
        return np.sqrt(d2, dtype=np.float64)
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms = np.where(norms == 0.0, 1.0, norms)
    Xn = X / norms
    cos_sim = Xn @ Xn.T
    return 1.0 - cos_sim


def top_k_neighbors_row(
    dist_row: np.ndarray, row_index: int, ordered_ids: list[str], top_k: int
) -> list[tuple[str, float, int]]:
    row = dist_row.copy()
    row[row_index] = np.inf
    n_other = max(0, len(row) - 1)
    k = min(top_k, n_other)
    if k == 0:
        return []
    part_idx = np.argpartition(row, k - 1)[:k]
    sorted_idx = part_idx[np.argsort(row[part_idx])]
    return [(ordered_ids[j], float(row[j]), rank) for rank, j in enumerate(sorted_idx, start=1)]


def geo_diverse_ok(
    neighbor_ids: list[str],
    anchor_id: str,
    fields_by_id: dict[str, dict[str, str]],
) -> bool:
    anchor_row = fields_by_id.get(anchor_id)
    if not anchor_row:
        return True
    anchor_c = country_for_fields_row(anchor_row)
    if not anchor_c:
        return True
    return any(
        (nc := country_for_fields_row(fields_by_id[nid])) is not None
        and nc != anchor_c
        for nid in neighbor_ids
        if nid in fields_by_id
    )


def year_gap_ok(
    neighbor_ids: list[str],
    anchor_id: str,
    fields_by_id: dict[str, dict[str, str]],
    min_gap: int,
) -> bool:
    anchor_row = fields_by_id.get(anchor_id)
    if not anchor_row:
        return True
    anchor_y = parse_int_year_final_date(anchor_row.get("final_date") or "")
    if anchor_y is None:
        return True
    return any(
        (ny := parse_int_year_final_date(fields_by_id[nid].get("final_date") or "")) is not None
        and abs(ny - anchor_y) >= min_gap
        for nid in neighbor_ids
        if nid in fields_by_id
    )


def chronology_spread_sum(
    neighbor_ids: list[str],
    anchor_id: str,
    fields_by_id: dict[str, dict[str, str]],
) -> float:
    anchor_row = fields_by_id.get(anchor_id)
    anchor_y = parse_int_year_final_date((anchor_row or {}).get("final_date") or "")
    if anchor_y is None:
        return 0.0
    total = 0.0
    for nid in neighbor_ids:
        if nid not in fields_by_id:
            continue
        ny = parse_int_year_final_date(fields_by_id[nid].get("final_date") or "")
        if ny is not None:
            total += float(abs(ny - anchor_y))
    return total


def pick_modal7(
    neighbors_pool: list[dict[str, object]],
    anchor_id: str,
    fields_by_id: dict[str, dict[str, str]],
) -> list[dict[str, object]]:
    """Pick 7 from top K shape neighbors: geo + ≥1000 yr gap, else geo + ≥500, else top 7."""
    if len(neighbors_pool) < 7:
        return list(neighbors_pool)
    pool = neighbors_pool[:TOP_SHAPE_NEIGHBORS_K]
    n_pool = len(pool)
    idx_range = range(n_pool)

    def best_combo_for_predicate(ok_pred: Callable[[list[str]], bool]) -> tuple[int, ...] | None:
        best_combo: tuple[int, ...] | None = None
        best_key: tuple[float, float] | None = None
        for combo in combinations(idx_range, 7):
            nids = [pool[i]["neighborId"] for i in combo]
            if not ok_pred(nids):
                continue
            rank_sum = float(sum(pool[i]["rank"] for i in combo))
            spread = -chronology_spread_sum(nids, anchor_id, fields_by_id)
            key = (rank_sum, spread)
            if best_key is None or key < best_key:
                best_key = key
                best_combo = combo
        return best_combo

    tier_ge1000 = best_combo_for_predicate(
        lambda nids: geo_diverse_ok(nids, anchor_id, fields_by_id)
        and year_gap_ok(nids, anchor_id, fields_by_id, 1000)
    )
    if tier_ge1000 is not None:
        return sorted([pool[i] for i in tier_ge1000], key=lambda x: x["rank"])

    tier_ge500 = best_combo_for_predicate(
        lambda nids: geo_diverse_ok(nids, anchor_id, fields_by_id)
        and year_gap_ok(nids, anchor_id, fields_by_id, 500)
    )
    if tier_ge500 is not None:
        return sorted([pool[i] for i in tier_ge500], key=lambda x: x["rank"])

    return sorted(pool[:7], key=lambda x: x["rank"])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--metric", choices=("euclidean", "cosine"), required=True)
    args = parser.parse_args()
    metric: str = args.metric

    fields_by_id, y_min, y_max = load_fields_maps(FIELDS_PATH)
    allowed_ids = set(fields_by_id.keys())

    ordered_ids, vectors, _ = build_feature_matrix(SILHOUETTE_PATH, allowed_ids)
    if not vectors:
        raise SystemExit("No silhouette vectors built (check CSV paths and object overlap).")

    X = np.array([vectors[oid] for oid in ordered_ids], dtype=np.float64)
    dist_mat = pairwise_distance_matrix(X, metric)

    out_entries: dict[str, dict[str, object]] = {}
    span_gap = (y_max - y_min) if y_min is not None and y_max is not None else None

    for i, anchor in enumerate(ordered_ids):
        ranked = top_k_neighbors_row(dist_mat[i], i, ordered_ids, TOP_SHAPE_NEIGHBORS_K)
        neighbors20 = [
            {"neighborId": oid, "rank": rk, "distance": round(d, 8)} for oid, d, rk in ranked
        ]
        neighbors_modal7 = pick_modal7(neighbors20, anchor, fields_by_id)
        out_entries[anchor] = {
            "neighbors20": neighbors20,
            "neighborsModal7": neighbors_modal7,
        }

    payload = {
        "metric": metric,
        "yearMinCorpus": y_min,
        "yearMaxCorpus": y_max,
        "maxPossibleYearGap": span_gap,
        "byObjectId": out_entries,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"shape_neighbors_{metric}.json"
    out_path.write_text(json.dumps(payload, indent=0), encoding="utf-8")
    print(f"Wrote {out_path} ({len(out_entries)} objects)")


if __name__ == "__main__":
    main()
