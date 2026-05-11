"""Recluster selected object IDs or manual color groups.

Examples from repo root:

python -m format_data.color.new.recluster_manual_color_ids \
  --groups cyan blue celadon green blue_green_family \
  --n-clusters 3 \
  --label blue_green_combined

python -m format_data.color.new.recluster_manual_color_ids \
  --ids 46959 47305 47375 48661 \
  --n-clusters 2 \
  --label cyan_subset
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from .palette_kmeans_vector import (
    COLOR_KMEANS_FEATURE_VERSION,
    DEFAULT_WEIGHT_HIST,
    DEFAULT_WEIGHT_RANKED,
    DEFAULT_WEIGHT_REL,
    palette_to_feature_vector,
    run_kmeans_on_palette_vectors,
)

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_INPUT = ROOT / "format_data" / "generated" / "color" / "object_color_fields_new.csv"
DEFAULT_MANUAL_JSON = ROOT / "format_data" / "color" / "new" / "manual_color_groups.json"
DEFAULT_OUTPUT_DIR = ROOT / "format_data" / "generated" / "color"
DEFAULT_JSON_OUTPUT = ROOT / "format_data" / "color" / "new" / "new_color_groups.json"


def cluster_ids_ordered_by_centroid_proximity(centers: np.ndarray) -> list[int]:
    """Permutation of 0..k-1, with nearby centroid projections adjacent in UI order."""
    k = int(centers.shape[0])
    if k <= 1:
        return list(range(k))
    x = np.asarray(centers, dtype=np.float64)
    x = x - x.mean(axis=0, keepdims=True)
    _, _, vt = np.linalg.svd(x, full_matrices=False)
    scores = x @ vt[0]
    return np.argsort(scores).astype(int).tolist()


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Recluster selected object IDs/manual color groups using the existing palette KMeans vector.",
    )
    p.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="CSV with colorgram columns.")
    p.add_argument(
        "--manual-json",
        type=Path,
        default=DEFAULT_MANUAL_JSON,
        help="JSON map of manual group name -> list of object IDs.",
    )
    p.add_argument("--groups", nargs="*", default=[], help="Manual group names to combine and recluster.")
    p.add_argument("--ids", nargs="*", default=[], help="Explicit object IDs to include.")
    p.add_argument(
        "--ids-file",
        type=Path,
        default=None,
        help="Optional text/JSON file of object IDs; accepts JSON arrays or comma/whitespace-separated text.",
    )
    p.add_argument("--n-clusters", type=int, required=True, help="Target K for reclustering.")
    p.add_argument("--label", default="manual_recluster", help="Label used in output filenames/group names.")
    p.add_argument("--group-prefix", default=None, help="Prefix for JSON group names; defaults to --label.")
    p.add_argument("--palette-slots", type=int, default=6, help="Ranked Lab slots (max 6).")
    p.add_argument("--ab-grid", type=int, default=8, help="Histogram grid side (must be 8 for current vectors).")
    p.add_argument("--w-ranked", type=float, default=DEFAULT_WEIGHT_RANKED)
    p.add_argument("--w-hist", type=float, default=DEFAULT_WEIGHT_HIST)
    p.add_argument("--w-rel", type=float, default=DEFAULT_WEIGHT_REL)
    p.add_argument("--random-state", type=int, default=42)
    p.add_argument("--kmeans-backend", choices=("lloyd", "bisecting"), default="lloyd")
    p.add_argument("--output", type=Path, default=None, help="Output CSV path.")
    p.add_argument("--cluster-ui-order-output", type=Path, default=None, help="Output UI-order JSON path.")
    p.add_argument(
        "--json-output",
        type=Path,
        default=DEFAULT_JSON_OUTPUT,
        help="Output JSON map of new group names -> object IDs.",
    )
    return p.parse_args()


def coerce_object_id(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return int(value)
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    return None


def load_manual_groups(path: Path) -> dict[str, list[int]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        return {}

    groups: dict[str, list[int]] = {}
    for name, values in raw.items():
        if not isinstance(values, list):
            continue
        ids = [oid for value in values if (oid := coerce_object_id(value)) is not None]
        groups[name] = ids
    return groups


def load_ids_file(path: Path) -> list[int]:
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = raw.replace(",", " ").split()
    if isinstance(parsed, list):
        values = parsed
    else:
        values = [parsed]
    return [oid for value in values if (oid := coerce_object_id(value)) is not None]


def selected_ids_from_args(args: argparse.Namespace) -> tuple[list[int], dict[int, list[str]]]:
    manual_groups = load_manual_groups(args.manual_json)
    selected: list[int] = []
    sources_by_id: dict[int, list[str]] = {}

    for group_name in args.groups:
        if group_name not in manual_groups:
            known = ", ".join(sorted(manual_groups.keys())[:12])
            raise SystemExit(f"Unknown manual group: {group_name!r}. Known examples: {known}")
        for object_id in manual_groups[group_name]:
            selected.append(object_id)
            sources_by_id.setdefault(object_id, []).append(group_name)

    for raw_id in args.ids:
        object_id = coerce_object_id(raw_id)
        if object_id is None:
            raise SystemExit(f"Invalid object ID: {raw_id!r}")
        selected.append(object_id)
        sources_by_id.setdefault(object_id, []).append("explicit_ids")

    if args.ids_file is not None:
        for object_id in load_ids_file(args.ids_file):
            selected.append(object_id)
            sources_by_id.setdefault(object_id, []).append(str(args.ids_file))

    return sorted(set(selected)), sources_by_id


def build_feature_rows(
    df: pd.DataFrame,
    selected_ids: set[int],
    args: argparse.Namespace,
) -> tuple[list[dict], list[np.ndarray], int, int]:
    eligible_rows: list[dict] = []
    vectors: list[np.ndarray] = []
    skipped_bw = 0
    skipped_no_vector = 0

    for _, row in df[df["objectID"].astype(int).isin(selected_ids)].iterrows():
        status = str(row.get("color_analysis_status", "") or "").strip()
        if status == "bw_original":
            skipped_bw += 1
            continue

        vec = palette_to_feature_vector(
            row.to_dict(),
            ranked_slots=args.palette_slots,
            ab_grid=args.ab_grid,
            w_ranked=args.w_ranked,
            w_hist=args.w_hist,
            w_rel=args.w_rel,
        )
        if vec is None:
            skipped_no_vector += 1
            continue

        eligible_rows.append(row.to_dict())
        vectors.append(vec)

    return eligible_rows, vectors, skipped_bw, skipped_no_vector


def main() -> None:
    args = parse_args()
    if args.ab_grid != 8:
        raise SystemExit("Current feature vectors require --ab-grid 8.")
    if args.palette_slots > 6:
        raise SystemExit("--palette-slots cannot exceed 6.")
    if not args.input.exists():
        raise SystemExit(f"Missing input CSV: {args.input}")
    if not args.manual_json.exists():
        raise SystemExit(f"Missing manual JSON: {args.manual_json}")

    selected_ids, sources_by_id = selected_ids_from_args(args)
    if not selected_ids:
        raise SystemExit("No object IDs selected. Pass --groups, --ids, and/or --ids-file.")

    df = pd.read_csv(args.input)
    if "objectID" not in df.columns:
        raise SystemExit("Input CSV must include objectID.")

    selected_id_set = set(selected_ids)
    present_ids = set(df["objectID"].dropna().astype(int).tolist())
    missing_ids = sorted(selected_id_set - present_ids)
    eligible_rows, vectors, skipped_bw, skipped_no_vector = build_feature_rows(df, selected_id_set, args)
    if not vectors:
        raise SystemExit("No selected IDs had eligible palette vectors.")

    X = np.vstack(vectors)
    labels, k_fit, kmeans_model, scaler = run_kmeans_on_palette_vectors(
        X,
        n_clusters=max(1, int(args.n_clusters)),
        random_state=args.random_state,
        backend=args.kmeans_backend,
    )
    labels_arr = np.asarray(labels, dtype=np.int64)

    centers_np = np.asarray(kmeans_model.cluster_centers_, dtype=np.float64)
    cluster_ui_order = cluster_ids_ordered_by_centroid_proximity(centers_np)

    X_scaled = scaler.transform(X)
    by_cluster_member_order: dict[str, list[int]] = {}
    for cid in range(k_fit):
        row_ix = np.flatnonzero(labels_arr == cid)
        if row_ix.size == 0:
            by_cluster_member_order[str(cid)] = []
            continue
        pts = X_scaled[row_ix]
        center = centers_np[cid]
        dists = np.linalg.norm(pts - center, axis=1)
        sorted_rows = row_ix[np.argsort(dists)]
        by_cluster_member_order[str(cid)] = [
            int(eligible_rows[int(r)]["objectID"]) for r in sorted_rows
        ]

    safe_label = str(args.label).strip().replace(" ", "_")
    group_prefix = str(args.group_prefix or safe_label).strip().replace(" ", "_")
    output = args.output or DEFAULT_OUTPUT_DIR / f"manual_recluster_{safe_label}_k{k_fit}.csv"
    order_output = args.cluster_ui_order_output or (
        DEFAULT_OUTPUT_DIR / f"manual_recluster_{safe_label}_k{k_fit}_ui_order.json"
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    order_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.parent.mkdir(parents=True, exist_ok=True)

    feature_version = f"{COLOR_KMEANS_FEATURE_VERSION}_manual_recluster_k{k_fit}"
    out = pd.DataFrame(
        {
            "objectID": [int(row["objectID"]) for row in eligible_rows],
            "manual_recluster_cluster": labels_arr.astype(int),
            "manual_recluster_k": [int(k_fit)] * len(eligible_rows),
            "manual_recluster_label": [safe_label] * len(eligible_rows),
            "source_manual_groups": [
                json.dumps(sources_by_id.get(int(row["objectID"]), []), separators=(",", ":"))
                for row in eligible_rows
            ],
            "feature_version": [feature_version] * len(eligible_rows),
        },
    )
    out.to_csv(output, index=False)

    new_groups = {
        f"{group_prefix}_{cid}": by_cluster_member_order[str(cid)]
        for cid in cluster_ui_order
    }
    args.json_output.write_text(json.dumps(new_groups, indent=2), encoding="utf-8")

    order_output.write_text(
        json.dumps(
            {
                "clusterUiOrder": cluster_ui_order,
                "byClusterMemberOrder": by_cluster_member_order,
                "kFit": int(k_fit),
                "label": safe_label,
                "groups": args.groups,
                "explicitIds": [int(x) for x in args.ids],
                "selectedIdCount": len(selected_ids),
                "eligibleIdCount": len(eligible_rows),
                "missingIdCount": len(missing_ids),
                "skippedBwOriginal": int(skipped_bw),
                "skippedNoVector": int(skipped_no_vector),
                "featureVersion": feature_version,
                "clusterPillOrderMethod": "svd_pc1_centroids_scaled",
                "memberOrderMethod": "euclidean_scaled_feature_space_to_centroid",
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(
        f"Wrote {len(out)} reclustered rows to {output}\n"
        f"  json_groups={args.json_output}\n"
        f"  ui_order={order_output}\n"
        f"  selected={len(selected_ids)}, eligible={len(eligible_rows)}, k_fit={k_fit}\n"
        f"  skipped_bw_original={skipped_bw}, skipped_no_vector={skipped_no_vector}, missing={len(missing_ids)}",
        flush=True,
    )


if __name__ == "__main__":
    main()
