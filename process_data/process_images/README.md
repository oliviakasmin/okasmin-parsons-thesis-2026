# Process Images

Image-processing stage for generating normalized vessel image assets used by features and clustering.

## Main scripts

- `process_images.py`
  - Primary batch runner.
  - For each object image: remove background -> standardize -> extract outline.
  - Writes 3 outputs per object to `process_data/real_images/`:
    - `<object_id>_no_bg.png`
    - `<object_id>_mask.png`
    - `<object_id>_outline.png`
  - Tracks completed IDs in `process_data/processed_ids.txt`.
  - Supports skip lists from `fetch_data/data/` (API errors, manual reject, reject IDs).

- `remove_background.py`
  - Background removal using `briaai/RMBG-2.0`.
  - Exposes `run_remove_background_step(...)` used by the batch runner.

- `crop_standardize.py`
  - Crops to foreground and standardizes vessel placement/scale on a square canvas.
  - Returns standardized image + standardized mask.

- `extract_mask_contours.py`
  - Extracts/draws contours from the standardized mask.
  - Produces the outline image used downstream.

- `utils.py`
  - Shared helpers for object metadata loading and atomic image saving.

## Typical usage

Run from repo root:

```bash
python process_data/process_images/process_images.py --skip-existing
```

Useful optional flags:
- `--start-index`, `--limit` for partial runs
- `--processed-ids-file` to control resume tracking
- `--skip-object-ids-file` (repeatable) to add custom skip lists
- `--max-errors` and `--gc-every` for long-batch stability

## Notes

- `reference/` and `test_process_image.ipynb` are for exploration/testing.
- `processed_ids.txt` stores successful object IDs for resumable batch processing.
