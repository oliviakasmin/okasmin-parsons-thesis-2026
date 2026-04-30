#!/usr/bin/env python3
"""
Re-run the clustering pipeline from ``run_cluster_kmeans_1st_weird.ipynb`` and write
``final_clusters_object_ids.csv`` and ``final_clusters_keys.csv``.

Run from anywhere (repo root is detected via ``package.json`` parents):

    python format_data/cluster_shape/re_export_clusters.py

Or:

    cd format_data/cluster_shape && python re_export_clusters.py
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

from cluster_utils import (
    attach_labels,
    build_labels_with_primary_isolated_weird,
    build_weighted_matrix,
    compute_cluster_compactness,
    evaluate_labels,
    export_final_cluster_csvs,
    find_repo_root,
    get_feature_groups,
    load_feature_table,
)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=None,
        help="Repository root (default: discover from this file)",
    )
    parser.add_argument(
        "--feature-csv",
        type=Path,
        default=None,
        help="Override path to silhouette_features.csv",
    )
    parser.add_argument(
        "--object-ids-csv",
        type=Path,
        default=None,
        help="Output path for object-level cluster CSV",
    )
    parser.add_argument(
        "--keys-csv",
        type=Path,
        default=None,
        help="Output path for cluster keys CSV",
    )
    parser.add_argument("--total-groups", type=int, default=12)
    parser.add_argument("--n-weird-buckets", type=int, default=3)
    parser.add_argument("--primary-weird-fraction", type=float, default=0.03)
    parser.add_argument("--secondary-weird-fraction", type=float, default=0.07)
    parser.add_argument("--primary-knn-k", type=int, default=7)
    parser.add_argument("--random-state", type=int, default=42)
    parser.add_argument("--lr-weight", type=float, default=1.0)
    parser.add_argument("--tb-weight", type=float, default=0.20)
    parser.add_argument("--shape-weight", type=float, default=1.0)
    parser.add_argument("--inner-weight", type=float, default=0.8)
    parser.add_argument("--inner-count-weight", type=float, default=0.5)
    parser.add_argument(
        "--figures-dir",
        type=Path,
        default=None,
        help="If set, save cluster-size bar chart and PCA scatter PNGs here (requires matplotlib).",
    )
    parser.add_argument(
        "--sweep-weird",
        action="store_true",
        help="Also print metrics for n_weird_buckets in 1..3 (notebook sweep cell).",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    start = args.repo_root if args.repo_root is not None else Path(__file__).resolve().parent
    repo_root = find_repo_root(start)

    feature_csv = args.feature_csv or (repo_root / "process_data/features/silhouette_features.csv")
    object_ids_csv = args.object_ids_csv or (
        repo_root / "format_data/cluster_shape/final_clusters_object_ids.csv"
    )
    keys_csv = args.keys_csv or (repo_root / "format_data/cluster_shape/final_clusters_keys.csv")

    df = load_feature_table(feature_csv)
    groups = get_feature_groups(df)
    X, _used_cols, _imputer, _scaler, _W = build_weighted_matrix(
        df,
        groups,
        lr_weight=args.lr_weight,
        tb_weight=args.tb_weight,
        shape_weight=args.shape_weight,
        inner_weight=args.inner_weight,
        inner_count_weight=args.inner_count_weight,
    )

    final_labels, details = build_labels_with_primary_isolated_weird(
        X,
        total_groups=args.total_groups,
        n_weird_buckets=args.n_weird_buckets,
        primary_weird_fraction=args.primary_weird_fraction,
        secondary_weird_fraction=args.secondary_weird_fraction,
        random_state=args.random_state,
        primary_knn_k=args.primary_knn_k,
    )

    df_labeled = attach_labels(df, final_labels)
    metrics = evaluate_labels(X, final_labels)
    compactness = compute_cluster_compactness(X, final_labels)

    summary = {k: v for k, v in details.items() if k != "isolation_score"}
    print("Run details:", summary)
    print("Metrics:", metrics)
    print("\nCompactness:\n", compactness.to_string())
    print("\nCluster counts:\n", df_labeled["cluster"].value_counts().sort_index().to_string())

    if args.sweep_weird:
        rows = []
        for weird_n in [1, 2, 3]:
            labels_s, details_s = build_labels_with_primary_isolated_weird(
                X,
                total_groups=12,
                n_weird_buckets=weird_n,
                primary_weird_fraction=args.primary_weird_fraction,
                secondary_weird_fraction=args.secondary_weird_fraction,
                random_state=args.random_state,
                primary_knn_k=args.primary_knn_k,
            )
            metrics_s = evaluate_labels(X, labels_s)
            compact_s = compute_cluster_compactness(X, labels_s)
            top8_mean_dist = (
                float(compact_s.head(8)["mean_dist_to_centroid"].mean())
                if len(compact_s) >= 8
                else float("nan")
            )
            rows.append(
                {
                    "weird_buckets": weird_n,
                    "core_clusters": 12 - weird_n,
                    "primary_weird_count": details_s["primary_weird_count"],
                    "secondary_weird_count": details_s["secondary_weird_count"],
                    "silhouette": metrics_s["silhouette"],
                    "calinski_harabasz": metrics_s["calinski_harabasz"],
                    "davies_bouldin": metrics_s["davies_bouldin"],
                    "top8_mean_dist": top8_mean_dist,
                }
            )
        sweep_df = pd.DataFrame(rows).sort_values(
            by=["silhouette", "davies_bouldin"], ascending=[False, True]
        )
        print("\nSweep weird-bucket count:\n", sweep_df.to_string(index=False))

    if args.figures_dir is not None:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from sklearn.decomposition import PCA

        args.figures_dir.mkdir(parents=True, exist_ok=True)
        counts = df_labeled["cluster"].value_counts().sort_index()
        plt.figure(figsize=(10, 4))
        counts.plot(kind="bar")
        plt.title("Cluster Size Distribution")
        plt.xlabel("cluster")
        plt.ylabel("count")
        plt.tight_layout()
        plt.savefig(args.figures_dir / "cluster_sizes.png", dpi=150)
        plt.close()

        pca = PCA(n_components=2, random_state=42)
        points = pca.fit_transform(X)
        plt.figure(figsize=(8, 6))
        sc = plt.scatter(points[:, 0], points[:, 1], c=final_labels, s=10, cmap="tab20", alpha=0.85)
        plt.title(
            f"PCA Distribution (total={args.total_groups}, weird={args.n_weird_buckets})"
        )
        plt.xlabel("PC1")
        plt.ylabel("PC2")
        plt.colorbar(sc, label="cluster")
        plt.tight_layout()
        plt.savefig(args.figures_dir / "pca_projection.png", dpi=150)
        plt.close()
        print(f"Saved figures under {args.figures_dir.resolve()}")

    export_final_cluster_csvs(
        df_labeled=df_labeled,
        X=X,
        n_weird_buckets=args.n_weird_buckets,
        object_ids_csv_path=object_ids_csv,
        keys_csv_path=keys_csv,
    )
    print(f"\nWrote:\n  {object_ids_csv.resolve()}\n  {keys_csv.resolve()}")


if __name__ == "__main__":
    main()
