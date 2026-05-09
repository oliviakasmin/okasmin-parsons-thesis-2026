"""KMeans grouping from Lab v1 palette vectors (102-D). Run from repo root:

python -m format_data.color.new.build_kmeans_color_groups
python -m format_data.color.new.build_kmeans_color_groups --n-clusters 24
"""

from __future__ import annotations

import argparse
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
DEFAULT_OUTPUT = ROOT / "format_data" / "generated" / "color" / "object_color_kmeans_clusters.csv"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="KMeans clusters from Lab palette fingerprint (slots + a*b* hist + scalars).",
    )
    p.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="CSV with colorgram columns.")
    p.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output CSV path.")
    p.add_argument(
        "--n-clusters",
        type=int,
        default=24,
        help="Target K for KMeans (clipped to number of eligible rows).",
    )
    p.add_argument(
        "--palette-slots",
        type=int,
        default=6,
        help="Number of ranked Lab slots (default 6; max 6 in v1).",
    )
    p.add_argument(
        "--ab-grid",
        type=int,
        default=8,
        help="Histogram grid side length (8 => 64 bins).",
    )
    p.add_argument("--w-ranked", type=float, default=DEFAULT_WEIGHT_RANKED, help="Block weight: ranked slots.")
    p.add_argument("--w-hist", type=float, default=DEFAULT_WEIGHT_HIST, help="Block weight: a*b* histogram.")
    p.add_argument("--w-rel", type=float, default=DEFAULT_WEIGHT_REL, help="Block weight: relational scalars.")
    p.add_argument("--random-state", type=int, default=42, help="KMeans RNG seed.")
    p.add_argument(
        "--kmeans-backend",
        choices=("lloyd", "bisecting"),
        default="lloyd",
        help="lloyd: classic KMeans++. bisecting: BisectingKMeans (often less extreme cluster sizes).",
    )
    p.add_argument("--max-rows", type=int, default=None, help="Optional row limit for smoke tests.")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    if args.ab_grid != 8:
        raise SystemExit("lab_slots_ab_hist_rel_v1 uses an 8×8 a*b* histogram; set --ab-grid 8.")
    if args.palette_slots > 6:
        raise SystemExit("--palette-slots cannot exceed 6 for v1 ranked block.")
    if not args.input.exists():
        raise SystemExit(f"Missing input: {args.input}")

    df = pd.read_csv(args.input)
    if args.max_rows is not None:
        df = df.iloc[: args.max_rows].copy()

    n = len(df)
    if n == 0:
        raise SystemExit("Input CSV has no rows.")

    eligible_positions: list[int] = []
    vectors: list[np.ndarray] = []

    for pos in range(n):
        row = df.iloc[pos]
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

    if len(vectors) >= 1:
        X = np.vstack(vectors)
        k_target = max(1, int(args.n_clusters))
        labels, k_fit, _, _ = run_kmeans_on_palette_vectors(
            X,
            n_clusters=k_target,
            random_state=args.random_state,
            backend=args.kmeans_backend,
        )
        for j, pos in enumerate(eligible_positions):
            full_cluster[pos] = int(labels[j])

    out = pd.DataFrame(
        {
            "objectID": df["objectID"].values.astype(np.int64),
            "color_kmeans_cluster": full_cluster.astype(int),
            "color_kmeans_k": [int(k_fit)] * n,
            "color_kmeans_feature_version": COLOR_KMEANS_FEATURE_VERSION,
        }
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(args.output, index=False)

    n_eligible = len(eligible_positions)
    print(
        f"Wrote {len(out)} rows to {args.output} "
        f"(feature={COLOR_KMEANS_FEATURE_VERSION}, eligible={n_eligible}, "
        f"k_fit={k_fit}, n_clusters_requested={args.n_clusters})",
        flush=True,
    )


if __name__ == "__main__":
    main()
