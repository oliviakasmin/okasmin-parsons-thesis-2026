#!/usr/bin/env python3
"""
Create silhouette-shape clusters from extracted features.

Outputs:
1) clusters.json: frontend-friendly cluster -> object ID lists
2) cluster_assignments.csv: one row per object with cluster assignment

Usage examples:
  python hf_space/analyze/clusters.py
  python hf_space/analyze/clusters.py --k 10
  python hf_space/analyze/clusters.py --features-csv hf_space/pipeline/features/silhouette_features.csv
"""

import argparse
import csv
import json
import math
import random
from pathlib import Path

DEFAULT_FEATURES_CSV = "hf_space/pipeline/features/test_silhouette_features.csv"
DEFAULT_MANUAL_REJECT_JSON = "pipeline/data/manual_reject_object_ids.json"
DEFAULT_OUTPUT_CLUSTERS_JSON = "test_assets/clusters.json"
DEFAULT_OUTPUT_ASSIGNMENTS_CSV = "test_assets/cluster_assignments.csv"
DEFAULT_K = 20
DEFAULT_MAX_ITER = 100
DEFAULT_SEED = 42
DEFAULT_SYMMETRY_THRESHOLD = 0.03


def parse_args():
    parser = argparse.ArgumentParser(description="Cluster vessel silhouettes from feature CSV.")
    parser.add_argument(
        "--features-csv",
        default=DEFAULT_FEATURES_CSV,
        help=f"Input silhouette feature CSV (default: {DEFAULT_FEATURES_CSV}).",
    )
    parser.add_argument(
        "--manual-reject-json",
        default=DEFAULT_MANUAL_REJECT_JSON,
        help=(f"Object IDs to exclude before clustering (default: {DEFAULT_MANUAL_REJECT_JSON})."),
    )
    parser.add_argument(
        "--k", type=int, default=DEFAULT_K, help=f"Number of clusters (default: {DEFAULT_K})."
    )
    parser.add_argument(
        "--max-iter",
        type=int,
        default=DEFAULT_MAX_ITER,
        help=f"Maximum K-means iterations (default: {DEFAULT_MAX_ITER}).",
    )
    parser.add_argument(
        "--seed", type=int, default=DEFAULT_SEED, help=f"Random seed (default: {DEFAULT_SEED})."
    )
    parser.add_argument(
        "--symmetry-threshold",
        type=float,
        default=DEFAULT_SYMMETRY_THRESHOLD,
        help=(
            "Rows with mean |l_i-r_i| <= threshold are treated as roughly symmetric "
            f"(default: {DEFAULT_SYMMETRY_THRESHOLD})."
        ),
    )
    parser.add_argument(
        "--clusters-json",
        default=DEFAULT_OUTPUT_CLUSTERS_JSON,
        help=f"Output clusters JSON path (default: {DEFAULT_OUTPUT_CLUSTERS_JSON}).",
    )
    parser.add_argument(
        "--assignments-csv",
        default=DEFAULT_OUTPUT_ASSIGNMENTS_CSV,
        help=f"Output assignments CSV path (default: {DEFAULT_OUTPUT_ASSIGNMENTS_CSV}).",
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


def load_manual_reject_ids(manual_reject_json_path):
    if not manual_reject_json_path.exists():
        return set()
    data = json.loads(manual_reject_json_path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(
            f"Expected reject list JSON array at {manual_reject_json_path}, got {type(data).__name__}."
        )
    return {str(item).strip() for item in data if str(item).strip()}


def load_feature_matrix(features_csv_path):
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

        left_by_idx = {}
        right_by_idx = {}
        for pos, col in enumerate(feature_columns):
            if col.startswith("l"):
                left_by_idx[col[1:]] = pos
            elif col.startswith("r"):
                right_by_idx[col[1:]] = pos
        lr_pairs = []
        for idx_text, left_pos in left_by_idx.items():
            right_pos = right_by_idx.get(idx_text)
            if right_pos is not None:
                lr_pairs.append((left_pos, right_pos))

        object_ids = []
        matrix = []
        for row in reader:
            object_id = str(row.get("object_id", "")).strip()
            if not object_id:
                continue
            vector = [parse_feature_value(row.get(col)) for col in feature_columns]
            object_ids.append(object_id)
            matrix.append(vector)
    return object_ids, matrix, lr_pairs


def filter_rows_by_object_ids(object_ids, matrix, excluded_object_ids):
    filtered_object_ids = []
    filtered_matrix = []
    excluded_count = 0

    for object_id, vector in zip(object_ids, matrix):
        if object_id in excluded_object_ids:
            excluded_count += 1
            continue
        filtered_object_ids.append(object_id)
        filtered_matrix.append(vector)

    return filtered_object_ids, filtered_matrix, excluded_count


def compute_symmetry_score(vector, lr_pairs):
    # Lower score means closer to left/right symmetry.
    diffs = []
    for left_idx, right_idx in lr_pairs:
        left_val = vector[left_idx]
        right_val = vector[right_idx]
        if math.isnan(left_val) or math.isnan(right_val):
            continue
        diffs.append(abs(left_val - right_val))
    if not diffs:
        return math.inf
    return sum(diffs) / len(diffs)


def split_by_symmetry(matrix, lr_pairs, symmetry_threshold):
    symmetric_indices = []
    asymmetric_indices = []
    symmetry_scores = []

    for idx, vector in enumerate(matrix):
        score = compute_symmetry_score(vector, lr_pairs)
        symmetry_scores.append(score)
        if score <= symmetry_threshold:
            symmetric_indices.append(idx)
        else:
            asymmetric_indices.append(idx)
    return symmetric_indices, asymmetric_indices, symmetry_scores


def allocate_k_between_groups(k_total, symmetric_count, asymmetric_count):
    non_empty_groups = int(symmetric_count > 0) + int(asymmetric_count > 0)
    if k_total < non_empty_groups:
        raise ValueError(
            f"k={k_total} is too small for non-empty symmetry groups ({non_empty_groups})."
        )

    if symmetric_count == 0:
        return 0, min(k_total, asymmetric_count)
    if asymmetric_count == 0:
        return min(k_total, symmetric_count), 0

    total_count = symmetric_count + asymmetric_count
    k_symmetric = round(k_total * (symmetric_count / total_count))
    k_symmetric = max(1, min(k_symmetric, symmetric_count))
    k_asymmetric = k_total - k_symmetric
    k_asymmetric = max(1, min(k_asymmetric, asymmetric_count))

    while (k_symmetric + k_asymmetric) > k_total:
        if k_symmetric > k_asymmetric and k_symmetric > 1:
            k_symmetric -= 1
        elif k_asymmetric > 1:
            k_asymmetric -= 1
        else:
            break

    while (k_symmetric + k_asymmetric) < k_total:
        if k_symmetric < symmetric_count:
            k_symmetric += 1
        elif k_asymmetric < asymmetric_count:
            k_asymmetric += 1
        else:
            break

    return k_symmetric, k_asymmetric


def subset_rows(matrix, indices):
    return [matrix[i] for i in indices]


def impute_missing_with_column_means(matrix):
    n_rows = len(matrix)
    n_cols = len(matrix[0]) if n_rows else 0
    col_means = []

    for col_idx in range(n_cols):
        values = [matrix[row_idx][col_idx] for row_idx in range(n_rows)]
        valid = [v for v in values if not math.isnan(v)]
        mean_val = sum(valid) / len(valid) if valid else 0.0
        col_means.append(mean_val)

    filled = []
    for row in matrix:
        filled.append([col_means[i] if math.isnan(v) else v for i, v in enumerate(row)])
    return filled


def zscore_columns(matrix):
    n_rows = len(matrix)
    n_cols = len(matrix[0]) if n_rows else 0
    means = []
    stds = []

    for col_idx in range(n_cols):
        values = [matrix[row_idx][col_idx] for row_idx in range(n_rows)]
        mean_val = sum(values) / n_rows if n_rows else 0.0
        variance = sum((v - mean_val) ** 2 for v in values) / n_rows if n_rows else 0.0
        std_val = math.sqrt(variance)
        if std_val == 0:
            std_val = 1.0
        means.append(mean_val)
        stds.append(std_val)

    scaled = []
    for row in matrix:
        scaled.append([(row[i] - means[i]) / stds[i] for i in range(n_cols)])
    return scaled


def squared_euclidean(a, b):
    return sum((av - bv) ** 2 for av, bv in zip(a, b))


def mean_vector(rows):
    n_rows = len(rows)
    n_cols = len(rows[0]) if n_rows else 0
    return [sum(row[col_idx] for row in rows) / n_rows for col_idx in range(n_cols)]


def kmeans_plus_plus_init(vectors, k, rng):
    centroids = []
    centroids.append(vectors[rng.randrange(len(vectors))][:])

    while len(centroids) < k:
        distances = []
        for vec in vectors:
            d2 = min(squared_euclidean(vec, centroid) for centroid in centroids)
            distances.append(d2)

        total = sum(distances)
        if total == 0:
            centroids.append(vectors[rng.randrange(len(vectors))][:])
            continue

        threshold = rng.random() * total
        running = 0.0
        chosen_index = len(vectors) - 1
        for idx, d2 in enumerate(distances):
            running += d2
            if running >= threshold:
                chosen_index = idx
                break
        centroids.append(vectors[chosen_index][:])
    return centroids


def run_kmeans(vectors, k, max_iter, seed):
    if not vectors:
        raise ValueError("No vectors to cluster.")
    if k <= 0:
        raise ValueError("k must be > 0.")
    if k > len(vectors):
        raise ValueError(f"k={k} is larger than number of rows ({len(vectors)}).")

    rng = random.Random(seed)
    centroids = kmeans_plus_plus_init(vectors, k, rng)
    labels = [-1] * len(vectors)

    for _ in range(max_iter):
        changed = False

        # Assignment step.
        for idx, vec in enumerate(vectors):
            best_cluster = min(range(k), key=lambda c: squared_euclidean(vec, centroids[c]))
            if labels[idx] != best_cluster:
                labels[idx] = best_cluster
                changed = True

        # Update step.
        cluster_rows = [[] for _ in range(k)]
        for idx, label in enumerate(labels):
            cluster_rows[label].append(vectors[idx])

        for cluster_idx in range(k):
            if cluster_rows[cluster_idx]:
                centroids[cluster_idx] = mean_vector(cluster_rows[cluster_idx])
            else:
                # Re-seed empty clusters with a random point.
                centroids[cluster_idx] = vectors[rng.randrange(len(vectors))][:]

        if not changed:
            break

    # Distances to assigned centroids.
    distances = []
    inertia = 0.0
    for idx, vec in enumerate(vectors):
        d2 = squared_euclidean(vec, centroids[labels[idx]])
        inertia += d2
        distances.append(math.sqrt(d2))

    return labels, centroids, distances, inertia


def find_cluster_exemplar(object_ids, vectors, labels, centroids, cluster_id):
    member_indices = [idx for idx, label in enumerate(labels) if label == cluster_id]
    if not member_indices:
        return None
    best_idx = min(
        member_indices, key=lambda idx: squared_euclidean(vectors[idx], centroids[cluster_id])
    )
    return object_ids[best_idx]


def write_assignments_csv(
    path,
    object_ids,
    labels,
    distances,
    symmetry_groups,
    symmetry_scores,
):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(
            [
                "object_id",
                "cluster_id",
                "symmetry_group",
                "symmetry_score",
                "distance_to_centroid",
            ]
        )
        for object_id, cluster_id, symmetry_group, symmetry_score, distance in zip(
            object_ids, labels, symmetry_groups, symmetry_scores, distances
        ):
            symmetry_score_str = (
                "inf" if not math.isfinite(symmetry_score) else f"{symmetry_score:.8f}"
            )
            writer.writerow(
                [
                    object_id,
                    cluster_id,
                    symmetry_group,
                    symmetry_score_str,
                    f"{distance:.8f}",
                ]
            )


def write_clusters_json(
    path,
    object_ids,
    labels,
    vectors,
    centroids,
    symmetry_groups,
    symmetry_threshold,
    distances,
):
    path.parent.mkdir(parents=True, exist_ok=True)
    k = len(centroids)

    clusters = []
    for cluster_id in range(k):
        members = [object_ids[idx] for idx, label in enumerate(labels) if label == cluster_id]
        member_indices = [idx for idx, label in enumerate(labels) if label == cluster_id]
        cluster_group = None
        for idx, label in enumerate(labels):
            if label == cluster_id:
                cluster_group = symmetry_groups[idx]
                break
        exemplar = find_cluster_exemplar(object_ids, vectors, labels, centroids, cluster_id)
        mean_distance = (
            sum(distances[idx] for idx in member_indices) / len(member_indices)
            if member_indices
            else math.inf
        )
        # Higher confidence means tighter (more compact) cluster.
        confidence_score = (
            0.0 if not math.isfinite(mean_distance) else (1.0 / (1.0 + mean_distance))
        )
        clusters.append(
            {
                "cluster_id": cluster_id,
                "symmetry_group": cluster_group,
                "size": len(members),
                "exemplar_object_id": exemplar,
                "mean_distance_to_centroid": (
                    None if not math.isfinite(mean_distance) else round(mean_distance, 8)
                ),
                "confidence_score": round(confidence_score, 8),
                "object_ids": members,
            }
        )

    clusters.sort(
        key=lambda cluster: (
            -cluster["confidence_score"],
            -cluster["size"],
            cluster["cluster_id"],
        )
    )
    for rank, cluster in enumerate(clusters, start=1):
        cluster["confidence_rank"] = rank

    payload = {
        "cluster_count": k,
        "total_objects": len(object_ids),
        "symmetry_threshold": symmetry_threshold,
        "confidence_definition": "confidence_score = 1 / (1 + mean_distance_to_centroid)",
        "clusters": clusters,
    }

    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main():
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[2]
    features_csv_path = repo_root / args.features_csv
    manual_reject_json_path = repo_root / args.manual_reject_json
    clusters_json_path = repo_root / args.clusters_json
    assignments_csv_path = repo_root / args.assignments_csv

    object_ids, matrix, lr_pairs = load_feature_matrix(features_csv_path)
    manual_reject_object_ids = load_manual_reject_ids(manual_reject_json_path)
    object_ids, matrix, excluded_count = filter_rows_by_object_ids(
        object_ids=object_ids,
        matrix=matrix,
        excluded_object_ids=manual_reject_object_ids,
    )
    if not object_ids:
        raise ValueError("No feature rows found.")

    symmetric_indices, asymmetric_indices, symmetry_scores = split_by_symmetry(
        matrix=matrix,
        lr_pairs=lr_pairs,
        symmetry_threshold=args.symmetry_threshold,
    )
    k_symmetric, k_asymmetric = allocate_k_between_groups(
        k_total=args.k,
        symmetric_count=len(symmetric_indices),
        asymmetric_count=len(asymmetric_indices),
    )

    labels = [-1] * len(object_ids)
    distances = [math.inf] * len(object_ids)
    centroids = []
    inertia = 0.0
    symmetry_groups = ["asymmetric"] * len(object_ids)

    next_cluster_id = 0
    if symmetric_indices:
        symmetric_matrix = subset_rows(matrix, symmetric_indices)
        symmetric_filled = impute_missing_with_column_means(symmetric_matrix)
        symmetric_scaled = zscore_columns(symmetric_filled)
        local_labels, local_centroids, local_distances, local_inertia = run_kmeans(
            vectors=symmetric_scaled,
            k=k_symmetric,
            max_iter=args.max_iter,
            seed=args.seed,
        )
        for local_idx, global_idx in enumerate(symmetric_indices):
            labels[global_idx] = next_cluster_id + local_labels[local_idx]
            distances[global_idx] = local_distances[local_idx]
            symmetry_groups[global_idx] = "symmetric"
        centroids.extend(local_centroids)
        next_cluster_id += len(local_centroids)
        inertia += local_inertia

    if asymmetric_indices:
        asymmetric_matrix = subset_rows(matrix, asymmetric_indices)
        asymmetric_filled = impute_missing_with_column_means(asymmetric_matrix)
        asymmetric_scaled = zscore_columns(asymmetric_filled)
        local_labels, local_centroids, local_distances, local_inertia = run_kmeans(
            vectors=asymmetric_scaled,
            k=k_asymmetric,
            max_iter=args.max_iter,
            seed=args.seed + 1,
        )
        for local_idx, global_idx in enumerate(asymmetric_indices):
            labels[global_idx] = next_cluster_id + local_labels[local_idx]
            distances[global_idx] = local_distances[local_idx]
            symmetry_groups[global_idx] = "asymmetric"
        centroids.extend(local_centroids)
        next_cluster_id += len(local_centroids)
        inertia += local_inertia

    # Scale full matrix for exemplar computation across final labels.
    full_scaled = zscore_columns(impute_missing_with_column_means(matrix))

    write_assignments_csv(
        assignments_csv_path,
        object_ids,
        labels,
        distances,
        symmetry_groups,
        symmetry_scores,
    )
    write_clusters_json(
        clusters_json_path,
        object_ids,
        labels,
        full_scaled,
        centroids,
        symmetry_groups,
        args.symmetry_threshold,
        distances,
    )

    print(f"Clustered {len(object_ids)} objects into k={args.k} clusters.")
    print(f"Excluded {excluded_count} objects from manual reject list ({manual_reject_json_path}).")
    print(
        f"Symmetry split: symmetric={len(symmetric_indices)} "
        f"asymmetric={len(asymmetric_indices)} "
        f"(threshold={args.symmetry_threshold})"
    )
    print(f"k split: symmetric={k_symmetric} asymmetric={k_asymmetric}")
    print(f"Inertia: {inertia:.6f}")
    print(f"Assignments CSV: {assignments_csv_path}")
    print(f"Clusters JSON: {clusters_json_path}")


if __name__ == "__main__":
    main()
