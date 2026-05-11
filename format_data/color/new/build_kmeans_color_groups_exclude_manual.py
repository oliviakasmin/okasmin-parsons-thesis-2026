"""KMeans on palette vectors excluding IDs listed in manual_color_groups.json.

Uses the same vector pipeline as build_kmeans_color_groups.py (Lab slots + a*b* histogram + scalars).
Rows whose objectID appears in any manual group are left unassigned (cluster -1) and are omitted from
the fit so centroids reflect only the remaining objects.

Run from repo root:

python -m format_data.color.new.build_kmeans_color_groups_exclude_manual
python -m format_data.color.new.build_kmeans_color_groups_exclude_manual --n-clusters 15
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
DEFAULT_OUTPUT = ROOT / "format_data" / "generated" / "color" / "object_color_kmeans_clusters_exclude_manual.csv"
DEFAULT_CLUSTER_UI_ORDER_OUTPUT = (
    ROOT / "format_data" / "generated" / "color" / "object_color_kmeans_exclude_manual_cluster_ui_order.json"
)


def cluster_ids_ordered_by_centroid_proximity(centers: np.ndarray) -> list[int]:
    """Permutation of 0..k-1: clusters with similar scaled centroids appear nearby (1D PC via SVD)."""
    k = int(centers.shape[0])
    if k <= 1:
        return list(range(k))
    x = np.asarray(centers, dtype=np.float64)
    x = x - x.mean(axis=0, keepdims=True)
    _, _, vt = np.linalg.svd(x, full_matrices=False)
    scores = x @ vt[0]
    return np.argsort(scores).astype(int).tolist()


def load_manual_exclude_object_ids(path: Path) -> set[int]:
    """Union of all numeric IDs across manual group arrays."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    out: set[int] = set()
    if not isinstance(raw, dict):
        return out
    for _group_name, ids in raw.items():
        if not isinstance(ids, list):
            continue
        for x in ids:
            if isinstance(x, bool):
                continue
            if isinstance(x, int):
                out.add(int(x))
            elif isinstance(x, float) and float(x).is_integer():
                out.add(int(x))
            elif isinstance(x, str) and x.strip().isdigit():
                out.add(int(x.strip()))
    return out


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="KMeans on palette vectors, excluding manual_color_groups.json IDs from the fit.",
    )
    p.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="CSV with colorgram columns.")
    p.add_argument(
        "--manual-json",
        type=Path,
        default=DEFAULT_MANUAL_JSON,
        help="JSON map of group name -> list of object IDs to exclude from clustering.",
    )
    p.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output CSV path.",
    )
    p.add_argument(
        "--cluster-ui-order-output",
        type=Path,
        default=DEFAULT_CLUSTER_UI_ORDER_OUTPUT,
        help="JSON: cluster ids in UI order (PC1 of scaled centroids).",
    )
    p.add_argument(
        "--n-clusters",
        type=int,
        default=15,
        help="Target K for KMeans (clipped to number of fit-eligible rows).",
    )
    p.add_argument("--palette-slots", type=int, default=6, help="Ranked Lab slots (max 6).")
    p.add_argument("--ab-grid", type=int, default=8, help="Histogram grid side (must be 8 for current vectors).")
    p.add_argument("--w-ranked", type=float, default=DEFAULT_WEIGHT_RANKED)
    p.add_argument("--w-hist", type=float, default=DEFAULT_WEIGHT_HIST)
    p.add_argument("--w-rel", type=float, default=DEFAULT_WEIGHT_REL)
    p.add_argument("--random-state", type=int, default=42)
    p.add_argument(
        "--kmeans-backend",
        choices=("lloyd", "bisecting"),
        default="lloyd",
    )
    p.add_argument("--max-rows", type=int, default=None)
    return p.parse_args()


def main() -> None:
    args = parse_args()
    if args.ab_grid != 8:
        raise SystemExit("Current feature vectors require --ab-grid 8.")
    if args.palette_slots > 6:
        raise SystemExit("--palette-slots cannot exceed 6.")
    if not args.input.exists():
        raise SystemExit(f"Missing input: {args.input}")
    if not args.manual_json.exists():
        raise SystemExit(f"Missing manual JSON: {args.manual_json}")

    exclude_ids = load_manual_exclude_object_ids(args.manual_json)

    df = pd.read_csv(args.input)
    if args.max_rows is not None:
        df = df.iloc[: args.max_rows].copy()

    n = len(df)
    if n == 0:
        raise SystemExit("Input CSV has no rows.")

    if "objectID" not in df.columns:
        raise SystemExit("Input CSV must include objectID.")

    eligible_positions: list[int] = []
    vectors: list[np.ndarray] = []
    skipped_manual = 0

    for pos in range(n):
        row = df.iloc[pos]
        oid = int(row["objectID"])
        if oid in exclude_ids:
            skipped_manual += 1
            continue

        status = str(row.get("color_analysis_status", "") or "").strip()
        if status == "bw_original":
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
            continue

        eligible_positions.append(pos)
        vectors.append(vec)

    full_cluster = np.full(n, -1, dtype=np.int64)
    k_fit = 0

    cluster_ui_order: list[int] = []
    by_cluster_member_order: dict[str, list[int]] = {}
    if len(vectors) >= 1:
        X = np.vstack(vectors)
        k_target = max(1, int(args.n_clusters))
        labels, k_fit, kmeans_model, scaler = run_kmeans_on_palette_vectors(
            X,
            n_clusters=k_target,
            random_state=args.random_state,
            backend=args.kmeans_backend,
        )
        labels_arr = np.asarray(labels, dtype=np.int64)
        for j, pos in enumerate(eligible_positions):
            full_cluster[pos] = int(labels_arr[j])

        if k_fit >= 1 and getattr(kmeans_model, "cluster_centers_", None) is not None:
            centers_np = np.asarray(kmeans_model.cluster_centers_, dtype=np.float64)
            cluster_ui_order = cluster_ids_ordered_by_centroid_proximity(centers_np)

            X_scaled = scaler.transform(X)
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
                    int(df.iloc[eligible_positions[int(r)]]["objectID"]) for r in sorted_rows
                ]

    feature_version_out = f"{COLOR_KMEANS_FEATURE_VERSION}_exclude_manual_k{k_fit}"

    out = pd.DataFrame(
        {
            "objectID": df["objectID"].values.astype(np.int64),
            "color_kmeans_cluster": full_cluster.astype(int),
            "color_kmeans_k": [int(k_fit)] * n,
            "color_kmeans_feature_version": feature_version_out,
        }
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(args.output, index=False)

    args.cluster_ui_order_output.parent.mkdir(parents=True, exist_ok=True)
    order_payload = {
        "clusterUiOrder": cluster_ui_order,
        "byClusterMemberOrder": by_cluster_member_order,
        "kFit": int(k_fit),
        "featureVersion": feature_version_out,
        "clusterPillOrderMethod": "svd_pc1_centroids_scaled",
        "memberOrderMethod": "euclidean_scaled_feature_space_to_centroid",
    }
    args.cluster_ui_order_output.write_text(
        json.dumps(order_payload, indent=2),
        encoding="utf-8",
    )

    n_fit = len(eligible_positions)
    print(
        f"Wrote {len(out)} rows to {args.output}\n"
        f"  cluster_ui_order → {args.cluster_ui_order_output}\n"
        f"  manual_json={args.manual_json} ({len(exclude_ids)} unique IDs in file)\n"
        f"  rows skipped as manual={skipped_manual}\n"
        f"  fit_eligible={n_fit}, k_fit={k_fit}, n_clusters_requested={args.n_clusters}\n"
        f"  feature_version={feature_version_out}",
        flush=True,
    )


if __name__ == "__main__":
    main()
