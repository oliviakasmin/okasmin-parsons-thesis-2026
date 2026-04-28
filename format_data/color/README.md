# Color Analysis Pipeline

Run from repo root:

`python -m format_data.color.analyze_colors`

## Inputs

- `fetch_data/data/objects.json` for `objectID` + `primaryImage`
- `process_data/generated/real_images/{objectID}_no_bg.png` for foreground colors

## Outputs

- `format_data/generated/object_color_fields.csv`
- `format_data/generated/object_color_cluster_centroids.csv`
- `format_data/generated/object_color_run_stats.json`
- `format_data/generated/color_bw_cache.csv` (URL grayscale cache)

## Notes

- Strict grayscale rule for original image: pixel is grayscale if `|R-G|<=1 && |G-B|<=1`.
- `color_eligible` is based on the original image only.
- If an eligible object has no `_no_bg` image (or extraction fails), `color_analysis_status` captures that explicitly.
- Dominant colors are saved as 8 hex colors (`dominant_colors_hex`) with matching shares (`dominant_colors_share`).
