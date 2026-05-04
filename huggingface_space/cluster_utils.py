import math
import json
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from PIL import Image

from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    calinski_harabasz_score,
    davies_bouldin_score,
    silhouette_score,
)
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler


# Used in: internal helper for all cluster notebooks.
def _sort_profile_cols(cols, prefix: str):
    return sorted(
        [col for col in cols if col.startswith(prefix) and col[len(prefix) :].isdigit()],
        key=lambda col: int(col[len(prefix) :]),
    )


# Used in: internal helper for all cluster notebooks.
def _validate_weight(name: str, value: float):
    if not np.isfinite(value):
        raise ValueError(f"{name} must be finite, got {value}")
    if value < 0:
        raise ValueError(f"{name} must be >= 0, got {value}")


# Used in: cluster_kmeans_1st_weird.ipynb, cluster_kmeans_outliers.ipynb.
def find_repo_root(start: Path) -> Path:
    start = start.resolve()
    for path in [start] + list(start.parents):
        if (path / "package.json").exists():
            return path
    raise RuntimeError("Could not locate repo root (package.json not found in parents).")


# Used in: cluster.ipynb, cluster_kmeans.ipynb, cluster_kmeans_outliers.ipynb, cluster_kmeans_1st_weird.ipynb.
def load_feature_table(feature_csv: Path) -> pd.DataFrame:
    df = pd.read_csv(feature_csv)
    df["object_id"] = df["object_id"].astype(str)
    return df


# Used in: cluster.ipynb, cluster_kmeans.ipynb, cluster_kmeans_outliers.ipynb, cluster_kmeans_1st_weird.ipynb.
def get_feature_groups(df: pd.DataFrame):
    lr_cols = _sort_profile_cols(df.columns, "l") + _sort_profile_cols(df.columns, "r")
    tb_cols = _sort_profile_cols(df.columns, "t") + _sort_profile_cols(df.columns, "b")

    symmetry_cols = [
        col
        for col in [
            "lr_profile_abs_diff_mean",
            "eccentricity",
            "upper_vs_lower_width_ratio",
            "centroid_x_norm",
            "centroid_offset_x",
        ]
        if col in df.columns
    ]

    contour_cols = [
        col for col in df.columns if col.startswith("contour_") or col.startswith("convexity_")
    ]
    hu_cols = [col for col in df.columns if col.startswith("hu") and col[2:].isdigit()]
    inner_count_cols = [col for col in df.columns if col == "inner_count"]
    inner_cols = [
        col for col in df.columns if col.startswith("inner") and col not in inner_count_cols
    ]
    shape_cols = list(dict.fromkeys(contour_cols + hu_cols + symmetry_cols))

    def numeric_only(cols):
        return [col for col in cols if pd.api.types.is_numeric_dtype(df[col])]

    return {
        "lr": numeric_only(lr_cols),
        "tb": numeric_only(tb_cols),
        "shape": numeric_only(shape_cols),
        "inner": numeric_only(inner_cols),
        "inner_count": numeric_only(inner_count_cols),
    }


# Used in: cluster.ipynb, cluster_kmeans.ipynb, cluster_kmeans_outliers.ipynb, cluster_kmeans_1st_weird.ipynb.
def build_weighted_matrix(
    df: pd.DataFrame,
    groups: dict,
    lr_weight: float = 1.0,
    tb_weight: float = 0.2,
    shape_weight: float = 1.0,
    inner_weight: float = 0.8,
    inner_count_weight: float = 0.5,
):
    _validate_weight("lr_weight", lr_weight)
    _validate_weight("tb_weight", tb_weight)
    _validate_weight("shape_weight", shape_weight)
    _validate_weight("inner_weight", inner_weight)
    _validate_weight("inner_count_weight", inner_count_weight)

    cols = (
        groups["lr"]
        + groups["tb"]
        + groups["shape"]
        + groups["inner"]
        + groups.get("inner_count", [])
    )
    if not cols:
        raise ValueError("No feature columns selected; cannot build weighted matrix.")
    X = df[cols].copy()

    imputer = SimpleImputer(strategy="median")
    X_imp = imputer.fit_transform(X)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_imp)

    weights = []
    for col in cols:
        if col in groups["lr"]:
            weights.append(lr_weight)
        elif col in groups["tb"]:
            weights.append(tb_weight)
        elif col in groups.get("inner_count", []):
            weights.append(inner_count_weight)
        elif col in groups["inner"]:
            weights.append(inner_weight)
        else:
            weights.append(shape_weight)

    W = np.array(weights, dtype=float)
    X_weighted = X_scaled * W
    return X_weighted, cols, imputer, scaler, W


def transform_new_sample(
    feature_dict: dict,
    cols: list,
    imputer: SimpleImputer,
    scaler: StandardScaler,
    W: np.ndarray,
) -> np.ndarray:
    """
    Map one raw feature dict (same keys as ``silhouette_features.csv``) into the
    weighted feature space built by ``build_weighted_matrix`` — same transform as each row of ``X``.
    Returns shape ``(1, len(cols))``.
    """
    new_row = pd.DataFrame([feature_dict])[cols]
    X_imp = imputer.transform(new_row)
    X_scaled = scaler.transform(X_imp)
    return X_scaled * W


# Used in: cluster.ipynb, cluster_kmeans.ipynb, cluster_kmeans_outliers.ipynb, cluster_kmeans_1st_weird.ipynb.
def evaluate_labels(X: np.ndarray, labels: np.ndarray) -> dict:
    labels = np.asarray(labels)
    unique = sorted(set(labels.tolist()))
    metrics = {
        "n_rows": int(X.shape[0]),
        "n_features": int(X.shape[1]),
        "n_clusters": len(unique),
    }
    if len(unique) >= 2 and X.shape[0] > len(unique):
        metrics["silhouette"] = float(silhouette_score(X, labels))
        metrics["calinski_harabasz"] = float(calinski_harabasz_score(X, labels))
        metrics["davies_bouldin"] = float(davies_bouldin_score(X, labels))
    else:
        metrics["silhouette"] = math.nan
        metrics["calinski_harabasz"] = math.nan
        metrics["davies_bouldin"] = math.nan
    return metrics


# Used in: cluster.ipynb, cluster_kmeans.ipynb, cluster_kmeans_outliers.ipynb, cluster_kmeans_1st_weird.ipynb.
def compute_cluster_compactness(X: np.ndarray, labels: np.ndarray) -> pd.DataFrame:
    rows = []
    for cluster_id in sorted(set(labels.tolist())):
        idx = np.where(labels == cluster_id)[0]
        Xc = X[idx]
        centroid = Xc.mean(axis=0)
        dists = np.linalg.norm(Xc - centroid, axis=1)
        rows.append(
            {
                "cluster": int(cluster_id),
                "size": int(len(idx)),
                "mean_dist_to_centroid": float(np.mean(dists)),
                "median_dist_to_centroid": float(np.median(dists)),
                "p90_dist_to_centroid": float(np.percentile(dists, 90)),
            }
        )
    return pd.DataFrame(rows).sort_values(
        by=["mean_dist_to_centroid", "p90_dist_to_centroid", "size"],
        ascending=[True, True, False],
    )


# Used in: cluster.ipynb, cluster_kmeans.ipynb, cluster_kmeans_outliers.ipynb, cluster_kmeans_1st_weird.ipynb.
def attach_labels(df: pd.DataFrame, labels: np.ndarray) -> pd.DataFrame:
    out = df.copy()
    out["cluster"] = labels
    return out


# Used in: cluster.ipynb, cluster_kmeans.ipynb, cluster_kmeans_outliers.ipynb, cluster_kmeans_1st_weird.ipynb.
def stack_cluster_outlines(
    df_labeled: pd.DataFrame,
    cluster_id: int,
    real_images_dir: Path,
    max_images=None,
    alpha_per_image=0.08,
    show_side_by_side: bool = True,
):
    rows = df_labeled[df_labeled["cluster"] == cluster_id]
    if max_images is not None:
        rows = rows.head(max_images)

    overlays = []
    for oid in rows["object_id"].astype(str):
        path = real_images_dir / f"{oid}_outline.png"
        if not path.exists():
            continue
        alpha = np.array(Image.open(path).convert("RGBA"), dtype=np.float32)[:, :, 3] / 255.0
        max_alpha = alpha.max()
        if max_alpha > 0:
            alpha = alpha / max_alpha
        overlays.append(alpha)

    if not overlays:
        print(f"No outline images for cluster {cluster_id}")
        return None

    stack = np.zeros_like(overlays[0], dtype=np.float32)
    for alpha in overlays:
        stack += alpha_per_image * alpha
    stack = np.clip(stack, 0.0, 1.0)

    if show_side_by_side:
        # White-on-black overlay view to inspect raw outline stacking
        # (including interior contours present in saved outline images).
        white_overlay = np.dstack([stack, stack, stack])

        fig, axes = plt.subplots(1, 2, figsize=(8, 4))

        axes[0].imshow(stack, cmap="magma")
        axes[0].set_title(f"Heatmap (n={len(overlays)})")
        axes[0].axis("off")

        axes[1].imshow(white_overlay)
        axes[1].set_title(f"White Overlay (n={len(overlays)})")
        axes[1].axis("off")

        fig.suptitle(f"Stacked Outlines - Cluster {cluster_id}")
        plt.tight_layout()
        plt.show()
    else:
        plt.figure(figsize=(6, 6))
        plt.imshow(stack, cmap="magma")
        plt.title(f"Stacked Outlines - Cluster {cluster_id} (n={len(overlays)})")
        plt.axis("off")
        plt.tight_layout()
        plt.show()
    return stack


# Used in: cluster_kmeans_outliers.ipynb.
def build_final_labels_with_weird_buckets(
    X: np.ndarray,
    total_groups: int = 12,
    n_weird_buckets: int = 2,
    weird_percentile: float = 90.0,
    random_state: int = 42,
    min_weird_count: int | None = None,
    max_weird_fraction: float | None = None,
):
    if total_groups < 2:
        raise ValueError("total_groups must be >= 2")
    if n_weird_buckets < 1 or n_weird_buckets > 3:
        raise ValueError("n_weird_buckets must be 1, 2, or 3")
    if n_weird_buckets >= total_groups:
        raise ValueError("n_weird_buckets must be smaller than total_groups")

    n_core = total_groups - n_weird_buckets

    core_model = KMeans(n_clusters=n_core, random_state=random_state, n_init="auto")
    core_labels = core_model.fit_predict(X)
    centers = core_model.cluster_centers_

    assigned_centers = centers[core_labels]
    dists = np.linalg.norm(X - assigned_centers, axis=1)

    threshold = np.percentile(dists, weird_percentile)
    weird_mask = dists >= threshold
    weird_idx = np.where(weird_mask)[0]

    if min_weird_count is not None and min_weird_count > 0 and len(weird_idx) < min_weird_count:
        weird_idx = np.argsort(dists)[-min_weird_count:]
        weird_mask = np.zeros_like(dists, dtype=bool)
        weird_mask[weird_idx] = True

    if max_weird_fraction is not None:
        if not (0 < max_weird_fraction <= 1):
            raise ValueError(f"max_weird_fraction must be in (0, 1], got {max_weird_fraction}")
        max_weird_count = max(n_weird_buckets, int(round(len(dists) * max_weird_fraction)))
        if len(weird_idx) > max_weird_count:
            capped_idx = np.argsort(dists)[-max_weird_count:]
            weird_mask = np.zeros_like(dists, dtype=bool)
            weird_mask[capped_idx] = True
            weird_idx = capped_idx

    if len(weird_idx) < n_weird_buckets:
        weird_idx = np.argsort(dists)[-n_weird_buckets:]
        weird_mask = np.zeros_like(dists, dtype=bool)
        weird_mask[weird_idx] = True

    final_labels = core_labels.copy().astype(int)

    if n_weird_buckets == 1:
        final_labels[weird_mask] = n_core
    else:
        weird_split = KMeans(n_clusters=n_weird_buckets, random_state=random_state, n_init="auto")
        weird_local = weird_split.fit_predict(X[weird_mask])
        final_labels[weird_mask] = n_core + weird_local

    details = {
        "n_core": n_core,
        "n_weird_buckets": n_weird_buckets,
        "weird_percentile": weird_percentile,
        "distance_threshold": float(threshold),
        "weird_count": int(weird_mask.sum()),
        "core_model": core_model,
        "distance_to_centroid": dists,
        "weird_mask": weird_mask,
    }

    return final_labels, details


# Used in: cluster_kmeans_1st_weird.ipynb.
def build_labels_with_primary_isolated_weird(
    X: np.ndarray,
    total_groups: int = 12,
    n_weird_buckets: int = 2,
    primary_weird_fraction: float = 0.03,
    secondary_weird_fraction: float = 0.07,
    random_state: int = 42,
    primary_knn_k: int = 5,
):
    """
    Build labels where weird bucket #1 is true globally isolated points
    (by kNN isolation score), then optionally split additional weird buckets
    from the next most-isolated points, and cluster the remainder as core.
    """
    if total_groups < 2:
        raise ValueError("total_groups must be >= 2")
    if n_weird_buckets < 1 or n_weird_buckets > 3:
        raise ValueError("n_weird_buckets must be 1, 2, or 3")
    if n_weird_buckets >= total_groups:
        raise ValueError("n_weird_buckets must be smaller than total_groups")
    if not (0 < primary_weird_fraction < 1):
        raise ValueError("primary_weird_fraction must be in (0,1)")
    if not (0 <= secondary_weird_fraction < 1):
        raise ValueError("secondary_weird_fraction must be in [0,1)")

    n = X.shape[0]
    k = int(max(2, min(primary_knn_k, max(2, n - 1))))
    nn = NearestNeighbors(n_neighbors=k + 1, metric="euclidean")
    nn.fit(X)
    distances, _ = nn.kneighbors(X)
    # ignore self-distance in col 0
    isolation_score = distances[:, 1:].mean(axis=1)

    order_desc = np.argsort(isolation_score)[::-1]
    primary_count = max(1, int(round(n * primary_weird_fraction)))
    primary_idx = order_desc[:primary_count]
    primary_mask = np.zeros(n, dtype=bool)
    primary_mask[primary_idx] = True

    labels = np.full(n, -1, dtype=int)
    labels[primary_mask] = 0  # Weird bucket #1

    remaining_order = [idx for idx in order_desc if not primary_mask[idx]]
    extra_weird_needed = n_weird_buckets - 1
    secondary_weird_indices = np.array([], dtype=int)

    if extra_weird_needed > 0 and secondary_weird_fraction > 0:
        secondary_count = max(extra_weird_needed, int(round(n * secondary_weird_fraction)))
        secondary_count = min(secondary_count, len(remaining_order))
        secondary_weird_indices = np.array(remaining_order[:secondary_count], dtype=int)

    if extra_weird_needed > 0 and len(secondary_weird_indices) >= extra_weird_needed:
        weird_split = KMeans(
            n_clusters=extra_weird_needed, random_state=random_state, n_init="auto"
        )
        weird_local = weird_split.fit_predict(X[secondary_weird_indices])
        labels[secondary_weird_indices] = 1 + weird_local

    # Core points = still unlabeled
    core_mask = labels == -1
    core_idx = np.where(core_mask)[0]
    n_core_clusters = total_groups - n_weird_buckets

    core_model = KMeans(n_clusters=n_core_clusters, random_state=random_state, n_init="auto")
    core_local = core_model.fit_predict(X[core_mask])
    labels[core_idx] = n_weird_buckets + core_local

    details = {
        "total_groups": total_groups,
        "n_weird_buckets": n_weird_buckets,
        "n_core_clusters": n_core_clusters,
        "primary_weird_fraction": primary_weird_fraction,
        "secondary_weird_fraction": secondary_weird_fraction,
        "primary_weird_count": int(primary_mask.sum()),
        "secondary_weird_count": int(np.sum(np.isin(np.arange(n), secondary_weird_indices))),
        "core_count": int(core_mask.sum()),
        "primary_knn_k": k,
        "isolation_score": isolation_score,
    }
    return labels, details


# Used in: internal helper for export_final_cluster_csvs (cluster_kmeans_1st_weird.ipynb export flow).
def _cluster_type_for_label(cluster_label: int, n_weird_buckets: int) -> str:
    if cluster_label == 0:
        return "outliers"
    if cluster_label < n_weird_buckets:
        return "weird_cluster"
    return "core"


# Used in: internal helper for export_final_cluster_csvs (cluster_kmeans_1st_weird.ipynb export flow).
def build_cluster_representatives(
    df_labeled: pd.DataFrame,
    X: np.ndarray,
    n_weird_buckets: int,
    cluster_prefix: str = "cluster_",
    centroid_round_digits: int = 6,
    top_k_closest: int = 5,
) -> pd.DataFrame:
    """
    Build one summary row per cluster including:
    - cluster name
    - cluster_type
    - count
    - closest_object_id (nearest sample to centroid)
    - top-K closest object_ids ordered by centroid distance
    - centroid_json (serialized centroid vector in weighted feature space)
    """
    labels = df_labeled["cluster"].to_numpy()
    if len(labels) != X.shape[0]:
        raise ValueError(
            f"Length mismatch: df_labeled has {len(labels)} rows but X has {X.shape[0]} rows"
        )

    rows = []
    for cluster_label in sorted(set(labels.tolist())):
        idx = np.where(labels == cluster_label)[0]
        Xc = X[idx]
        centroid = Xc.mean(axis=0)
        dists = np.linalg.norm(Xc - centroid, axis=1)
        order = np.argsort(dists)

        k = int(max(1, top_k_closest))
        top_local = order[: min(k, len(order))]
        top_global = idx[top_local]
        top_object_ids = [str(df_labeled.iloc[int(i)]["object_id"]) for i in top_global]

        nearest_local = int(np.argmin(dists))
        nearest_global = int(idx[nearest_local])
        closest_object_id = str(df_labeled.iloc[nearest_global]["object_id"])

        centroid_list = [round(float(v), centroid_round_digits) for v in centroid.tolist()]
        rows.append(
            {
                "cluster": f"{cluster_prefix}{int(cluster_label)}",
                "cluster_type": _cluster_type_for_label(int(cluster_label), n_weird_buckets),
                "count": int(len(idx)),
                "closest_object_id": closest_object_id,
                "closest_dist_to_centroid": float(dists[nearest_local]),
                "closest_object_ids_top5": json.dumps(top_object_ids),
                "closest_object_id_1": top_object_ids[0] if len(top_object_ids) > 0 else "",
                "closest_object_id_2": top_object_ids[1] if len(top_object_ids) > 1 else "",
                "closest_object_id_3": top_object_ids[2] if len(top_object_ids) > 2 else "",
                "closest_object_id_4": top_object_ids[3] if len(top_object_ids) > 3 else "",
                "closest_object_id_5": top_object_ids[4] if len(top_object_ids) > 4 else "",
                "centroid_json": json.dumps(centroid_list),
            }
        )

    return pd.DataFrame(rows).sort_values(by="cluster").reset_index(drop=True)


def _distances_to_cluster_centroids(df_labeled: pd.DataFrame, X: np.ndarray) -> np.ndarray:
    """Euclidean distance from each row's feature vector to its cluster centroid in ``X`` space."""
    labels = df_labeled["cluster"].astype(int).to_numpy()
    if len(labels) != X.shape[0]:
        raise ValueError(
            f"Length mismatch: df_labeled has {len(labels)} rows but X has {X.shape[0]} rows"
        )
    dist = np.zeros(len(labels), dtype=float)
    for cl in np.unique(labels):
        idx = np.where(labels == cl)[0]
        if idx.size == 0:
            continue
        Xc = X[idx]
        centroid = Xc.mean(axis=0)
        dist[idx] = np.linalg.norm(Xc - centroid, axis=1)
    return dist


# Used in: cluster_kmeans_1st_weird.ipynb.
def export_final_cluster_csvs(
    df_labeled: pd.DataFrame,
    X: np.ndarray,
    n_weird_buckets: int,
    object_ids_csv_path: Path,
    keys_csv_path: Path,
    cluster_prefix: str = "cluster_",
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Export:
    1) object-level assignments CSV (rows sorted by numeric cluster id, then by
       ascending distance to that cluster's centroid so downstream lists match
       centroid proximity order)
    2) cluster-level keys CSV including representative object and centroid
    """
    labeled = df_labeled.copy()
    labeled["cluster"] = labeled["cluster"].astype(int)
    labeled["_dist_to_centroid"] = _distances_to_cluster_centroids(labeled, X)
    labeled["cluster_type"] = labeled["cluster"].map(
        lambda c: _cluster_type_for_label(int(c), n_weird_buckets)
    )
    labeled = labeled.sort_values(
        by=["cluster", "_dist_to_centroid", "object_id"],
        ascending=[True, True, True],
    )
    labeled["cluster"] = labeled["cluster"].map(lambda c: f"{cluster_prefix}{int(c)}")

    object_cols = ["object_id", "cluster", "cluster_type"]
    out_objects = labeled[object_cols].copy()

    keys_df = build_cluster_representatives(
        df_labeled=df_labeled,
        X=X,
        n_weird_buckets=n_weird_buckets,
        cluster_prefix=cluster_prefix,
    )

    object_ids_csv_path = Path(object_ids_csv_path)
    keys_csv_path = Path(keys_csv_path)
    object_ids_csv_path.parent.mkdir(parents=True, exist_ok=True)
    keys_csv_path.parent.mkdir(parents=True, exist_ok=True)

    out_objects.to_csv(object_ids_csv_path, index=False)
    keys_df.to_csv(keys_csv_path, index=False)
    return out_objects, keys_df
