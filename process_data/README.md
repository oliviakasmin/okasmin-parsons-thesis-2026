# Process Data

This directory contains the image-processing and shape-analysis pipeline used after object metadata is fetched.

## Directory structure

- `process_images/`
  - Active image pipeline.
  - `remove_background.py`: background removal with `briaai/RMBG-2.0`.
  - `crop_standardize.py`: crop + normalize vessel placement/size.
  - `extract_mask_contours.py`: generate outline images from masks.
  - `process_images.py`: batch runner that writes `_no_bg`, `_mask`, `_outline` images to `generated/real_images/`.
  - `utils.py`: shared helpers (object loading + atomic file save).

- `features/`
  - Active feature extraction pipeline.
  - `get_features.py`: per-mask feature extraction (profiles, contour geometry, Hu, inner-contour signals, symmetry-related fields).
  - `process_get_features.py`: batch/resumable CSV writer for silhouette features.

- `../format_data/cluster_shape/`
  - Active clustering experimentation and outputs.
  - Notebook workflow for weighted clustering + evaluation.
  - Stores final cluster outputs (`final_clusters_object_ids.csv`, `final_clusters_keys.csv`) and helper utilities (`cluster_utils.py`).

- `generated/real_images/`
  - Generated processing outputs used by downstream analysis/frontend experiments.

- `test_analyze/old/` and `old/`
  - Legacy experiments and earlier scripts kept for reference (not the primary current flow).

## Current end-to-end flow

1. Process source images into `generated/real_images/` via `process_images/process_images.py`.
2. Extract shape features into `features/silhouette_features.csv`.
3. Run clustering experiments in `format_data/cluster_shape/` notebooks and export final cluster CSVs.
