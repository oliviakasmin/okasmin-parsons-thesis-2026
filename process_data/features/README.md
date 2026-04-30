# Features

This directory contains silhouette feature extraction code and generated CSV outputs used by clustering in `format_data/cluster_shape`.

## Files

- `get_features.py`
  - Core per-mask feature extraction logic.
  - Reads `*_mask.png` files and returns one feature row per object.

- `process_get_features.py`
  - Batch runner with resume-friendly writing.
  - Writes/updates `silhouette_features.csv` and optional skipped-record logs.

- `silhouette_features.csv`
  - Main feature table used by clustering notebooks/utilities.

## Input and output

- **Input masks:** default `process_data/generated/real_images/*_mask.png`
- **Output CSV:** default `process_data/features/silhouette_features.csv`
- **Row granularity:** one row per `object_id`

## Extracted features (what each means)

### Identity and mask geometry

- `object_id`: object identifier derived from filename.
- `mask_width`, `mask_height`: mask pixel dimensions.
- `bbox_left`, `bbox_top`, `bbox_right`, `bbox_bottom`: foreground bounding box in mask coordinates.

### Profile sampling features (64 samples by default)

Sampling is evenly distributed across the mask extents (`DEFAULT_NUM_SAMPLES = 64`):

- `l1..l64`: normalized distance from left edge to first foreground pixel for sampled rows.
- `r1..r64`: normalized distance from right edge to first foreground pixel for sampled rows.
- `t1..t64`: normalized distance from top edge to first foreground pixel for sampled columns.
- `b1..b64`: normalized distance from bottom edge to first foreground pixel for sampled columns.
- `valid_row_count`: count of sampled rows with any foreground.
- `valid_col_count`: count of sampled columns with any foreground.
- `lr_profile_abs_diff_mean`: mean absolute left-right profile difference; proxy for left/right asymmetry.

### Outer contour geometry (largest outer contour)

- `contour_area`: area in pixels.
- `contour_area_norm`: area normalized by total image area.
- `contour_perimeter`: perimeter in pixels.
- `contour_perimeter_norm`: perimeter normalized by image perimeter.
- `contour_circularity`: \(4*pi*area / perimeter^2\); closer to 1 is more circle-like.
- `contour_extent`: area / bounding-rectangle-area.
- `contour_aspect_ratio`: bounding-rectangle width / height.
- `contour_solidity`: area / convex-hull area.

### Convexity-defect / handle-like shape complexity

- `convexity_defect_count`: number of convexity defects.
- `convexity_defect_depth_sum`: total defect depth.
- `convexity_defect_depth_mean`: mean defect depth.
- `convexity_defect_depth_max`: maximum defect depth.

### Moment-based shape descriptors

- `hu1..hu7`: log-transformed Hu invariant moments (rotation/scale/translation robust descriptors).

### Symmetry and placement signals

- `eccentricity`: elongation from contour moments (higher means more elongated).
- `upper_vs_lower_width_ratio`: mean top-half width / mean bottom-half width.
- `centroid_x_norm`: normalized x-position of contour centroid.
- `centroid_offset_x`: absolute offset of centroid from horizontal center (0.5).

### Interior contour (hole) features

Interior contours are descendants of the main outer contour in contour hierarchy.

- Top 3 largest interior contours:
  - `inner1_area`, `inner1_perimeter`, `inner1_circularity`
  - `inner2_area`, `inner2_perimeter`, `inner2_circularity`
  - `inner3_area`, `inner3_perimeter`, `inner3_circularity`
- Aggregates:
  - `inner_count`: number of interior contours.
  - `inner_area_sum`, `inner_area_sum_norm`
  - `inner_area_ratio_to_outer`
  - `inner_area_mean`, `inner_area_mean_norm`
  - `inner_perimeter_sum`, `inner_perimeter_sum_norm`

## Where these are used in clustering

Feature grouping and weighting are defined in `format_data/cluster_shape/cluster_utils.py`:

- Groups:
  - `lr`: `l*` + `r*`
  - `tb`: `t*` + `b*`
  - `shape`: `contour_*`, `convexity_*`, `hu*`, and selected symmetry signals
  - `inner`: `inner*` features except `inner_count`
  - `inner_count`: separate single-feature group

- Default weights in `build_weighted_matrix(...)`:
  - `lr_weight = 1.0`
  - `tb_weight = 0.2`
  - `shape_weight = 1.0`
  - `inner_weight = 0.8`
  - `inner_count_weight = 0.5`

These defaults intentionally downweight top/bottom profiles and interior-count magnitude versus main silhouette shape.

## Notes

- Missing/undefined feature values are preserved as `NaN` during extraction and imputed later in clustering (`SimpleImputer`, median strategy in `cluster_utils.py`).
- Not every CSV column is necessarily used in clustering; grouping logic in `cluster_utils.py` is the source of truth for active feature selection.
