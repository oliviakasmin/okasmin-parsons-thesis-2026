# Color Analysis Pipeline

Run from repo root:

`python -m format_data.color.analyze_colors`

Re-run clustering only (without re-fetching/re-extracting image colors):

`python -m format_data.color.recluster_colors --max-groups 10 --multicolor-threshold 0.35`

## Inputs

- `fetch_data/data/objects.json` for `objectID` + `primaryImage`
- `process_data/generated/real_images/{objectID}_no_bg.png` for foreground colors

## Outputs

- `format_data/generated/color/object_color_fields.csv`
- `format_data/generated/color/object_color_cluster_centroids.csv`
- `format_data/generated/color/object_color_group_labels.csv`
- `format_data/generated/color/object_color_run_stats.json`
- `format_data/generated/color/object_color_cluster_stats.json`
- `format_data/generated/color/color_bw_cache.csv` (URL grayscale cache)

## Notes

- Strict grayscale rule for original image: pixel is grayscale if `|R-G|<=1 && |G-B|<=1`.
- `color_eligible` is based on the original image only.
- If an eligible object has no `_no_bg` image (or extraction fails), `color_analysis_status` captures that explicitly.
- Dominant colors are saved as 8 hex colors (`dominant_colors_hex`) with matching shares (`dominant_colors_share`).
- Clustering now assigns a `multicolor` bucket first using hue concentration (`top_hue_bin_share < 0.35` by default), then clusters the remaining objects into the other groups.
