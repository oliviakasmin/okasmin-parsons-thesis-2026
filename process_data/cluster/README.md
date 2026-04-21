# Cluster Experimenting (Final Approach)

This folder contains the final clustering workflow used to group vessel silhouettes into 12 total groups with:
- 1 primary outlier bucket (`outliers`)
- 2 secondary weird buckets (`weird_cluster`)
- 9 core shape buckets (`core`)

The final experiment notebook is:
- `cluster_kmeans_1st_weird.ipynb`

## Final Notebook Approach

The final approach in `cluster_kmeans_1st_weird.ipynb` is:
- Load silhouette features and build a weighted feature matrix.
- Detect a primary isolated weird set first (kNN-distance based isolation).
- Split remaining weird candidates into extra weird buckets.
- Cluster the rest into core clusters so total groups stay fixed at 12.
- Evaluate using silhouette, Calinski-Harabasz, Davies-Bouldin, compactness, and overlay visual checks.

## Variables We Tuned

During experimentation, we repeatedly toggled these variables to balance cluster tightness, outlier handling, and interpretability:

- `TOTAL_GROUPS`
  - Fixed target number of output clusters (set to 12 in final runs).

- `N_WEIRD_BUCKETS`
  - Number of weird groups after primary isolation (tested 1, 2, 3; final used 2 weird clusters plus 1 outlier bucket).

- `PRIMARY_WEIRD_FRACTION`
  - Fraction of points selected first as the most isolated outliers via kNN-distance ranking.
  - Controls how aggressive the primary outlier bucket is.

- `SECONDARY_WEIRD_FRACTION`
  - Fraction used for additional weird grouping after primary outlier extraction.
  - Controls how many non-core points are set aside before core clustering.

- `PRIMARY_KNN_K`
  - Neighbor count used for the isolation score.
  - Lower values focus on very local isolation; higher values reflect broader neighborhood isolation.

- `RANDOM_STATE`
  - Seed for reproducibility of k-means steps and consistent cluster assignment across reruns.

- Feature-group weights in `build_weighted_matrix(...)`
  - `LR_W` for left/right profile features.
  - `TB_W` for top/bottom profile features.
  - `SHAPE_W` for contour/shape-level features.
  - `INNER_W` for interior-contour summary features.
  - `INNER_COUNT_W` for the explicit interior count feature.
  - These were tuned to keep dominant silhouette shape primary while still preserving interior/handle information.

## Final Saved Data

Two final outputs are saved for downstream use:

- `final_clusters_object_ids.csv`
  - One row per object.
  - Columns: `object_id`, `cluster`, `cluster_type`.
  - `cluster` names are normalized (`cluster_0` ... `cluster_11`).

- `final_clusters_keys.csv`
  - One row per cluster key (no object IDs).
  - Columns: `cluster`, `cluster_type`, `count`.
  - `count` is the number of objects in each cluster.

Current cluster key counts:
- `cluster_0`: outliers (117)
- `cluster_1`: weird_cluster (164)
- `cluster_2`: weird_cluster (108)
- `cluster_3` to `cluster_11`: core (counts listed in `final_clusters_keys.csv`)

## Thought Process (Brief)

The goal was not only good numeric metrics, but useful visual grouping for shape review.  
To do that, we separated truly isolated shapes first, then clustered the remaining set to preserve tighter core groups.  
We monitored both metric quality and visual overlays while adjusting the variables above.
This balances three needs: a clean outlier bucket, interpretable weird buckets, and stable high-count core clusters.
