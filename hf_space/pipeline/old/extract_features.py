# RUN THIS FILE FROM ROOT DIRECTORY
# python hf_space/pipeline/extract_features.py

import csv
import math
from pathlib import Path

from PIL import Image

DEFAULT_NUM_SAMPLES = 64
DEFAULT_ALPHA_THRESHOLD = 16
DEFAULT_NORMALIZE = True
MASK_GLOB = "*_mask_standardized.png"


def get_sample_rows(height, n_samples):
    # Evenly spread sampling rows from top (0) to bottom (height-1).
    if n_samples <= 0:
        raise ValueError("n_samples must be > 0")
    if height <= 0:
        raise ValueError("height must be > 0")
    if n_samples == 1:
        return [height // 2]
    return [round(i * (height - 1) / (n_samples - 1)) for i in range(n_samples)]


def load_binary_mask(mask_path, alpha_threshold=DEFAULT_ALPHA_THRESHOLD):
    # Use alpha when available (RGBA mask exports), otherwise grayscale.
    image = Image.open(mask_path)
    if "A" in image.getbands():
        mask_channel = image.getchannel("A")
    else:
        mask_channel = image.convert("L")
    # Convert to a clean binary foreground mask for stable distance checks.
    return mask_channel.point(lambda p: 255 if p >= alpha_threshold else 0)


def extract_object_id(mask_path):
    return mask_path.stem.replace("_mask_standardized", "")


def extract_silhouette_row(mask_pixels, y, width, normalize=DEFAULT_NORMALIZE):
    left_x = None
    right_x = None

    # Scan from left edge to find first foreground pixel.
    for x in range(width):
        if mask_pixels[x, y] != 0:
            left_x = x
            break

    # Scan from right edge to find first foreground pixel.
    for x in range(width - 1, -1, -1):
        if mask_pixels[x, y] != 0:
            right_x = x
            break

    # If no foreground exists on this row, mark as missing.
    if left_x is None or right_x is None:
        return math.nan, math.nan, False

    # Distances represent edge-to-silhouette offsets for this row.
    left_distance = left_x
    right_distance = (width - 1) - right_x
    if normalize:
        # Normalize to [0,1] so features are comparable across images.
        left_distance = left_distance / width
        right_distance = right_distance / width
    return left_distance, right_distance, True


def extract_features_for_mask(
    mask_path,
    n_samples=DEFAULT_NUM_SAMPLES,
    alpha_threshold=DEFAULT_ALPHA_THRESHOLD,
    normalize=DEFAULT_NORMALIZE,
):
    # Step 1: load and validate mask.
    binary_mask = load_binary_mask(mask_path, alpha_threshold=alpha_threshold)
    bbox = binary_mask.getbbox()
    if bbox is None:
        raise ValueError("Mask has no foreground pixels.")

    # Step 2: prepare fixed y-samples and direct pixel access.
    width, height = binary_mask.size
    sample_rows = get_sample_rows(height=height, n_samples=n_samples)
    pixels = binary_mask.load()

    # Step 3: initialize output row with id + quality diagnostics.
    record = {
        "object_id": extract_object_id(mask_path),
        "mask_width": width,
        "mask_height": height,
        "bbox_top": bbox[1],
        "bbox_bottom": bbox[3],
        "valid_row_count": 0,
    }

    # Step 4: compute l_i / r_i features for each sampled row.
    for idx, y in enumerate(sample_rows, start=1):
        left_value, right_value, has_foreground = extract_silhouette_row(
            pixels, y, width, normalize=normalize
        )
        record[f"l{idx}"] = left_value
        record[f"r{idx}"] = right_value
        if has_foreground:
            record["valid_row_count"] += 1

    return record


def build_feature_table(
    input_dir,
    n_samples=DEFAULT_NUM_SAMPLES,
    alpha_threshold=DEFAULT_ALPHA_THRESHOLD,
    normalize=DEFAULT_NORMALIZE,
):
    # Batch over all standardized mask files and collect rows.
    mask_paths = sorted(input_dir.glob(MASK_GLOB))
    rows = []
    skipped = []

    for mask_path in mask_paths:
        try:
            row = extract_features_for_mask(
                mask_path=mask_path,
                n_samples=n_samples,
                alpha_threshold=alpha_threshold,
                normalize=normalize,
            )
            rows.append(row)
        except Exception as error:
            skipped.append((mask_path.name, str(error)))

    return rows, skipped, len(mask_paths)


def write_feature_csv(rows, output_path, n_samples):
    # Build deterministic schema: metadata first, then l1..lN and r1..rN.
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "object_id",
        "mask_width",
        "mask_height",
        "bbox_top",
        "bbox_bottom",
        "valid_row_count",
    ]
    fieldnames.extend([f"l{i}" for i in range(1, n_samples + 1)])
    fieldnames.extend([f"r{i}" for i in range(1, n_samples + 1)])

    with output_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def print_summary(total_files, rows, skipped, output_path, n_samples, alpha_threshold):
    # Report data quality and extraction coverage for this run.
    succeeded = len(rows)
    skipped_count = len(skipped)
    mean_valid_rows = sum(row["valid_row_count"] for row in rows) / succeeded if succeeded else 0.0
    print("Feature extraction complete.")
    print(f"- total mask files: {total_files}")
    print(f"- succeeded: {succeeded}")
    print(f"- skipped: {skipped_count}")
    print(f"- mean valid rows: {mean_valid_rows:.2f} / {n_samples}")
    print(f"- alpha threshold: {alpha_threshold}")
    print(f"- output: {output_path}")
    if skipped:
        print("- skipped files:")
        for name, reason in skipped:
            print(f"  - {name}: {reason}")


def main():
    # Default pipeline paths (read standardized masks, write feature table).
    pipeline_dir = Path(__file__).resolve().parent
    input_dir = pipeline_dir / "test_images"
    output_path = pipeline_dir / "features" / "silhouette_features.csv"

    # Run extraction, persist CSV, then print run summary.
    rows, skipped, total_files = build_feature_table(
        input_dir=input_dir,
        n_samples=DEFAULT_NUM_SAMPLES,
        alpha_threshold=DEFAULT_ALPHA_THRESHOLD,
        normalize=DEFAULT_NORMALIZE,
    )
    write_feature_csv(rows=rows, output_path=output_path, n_samples=DEFAULT_NUM_SAMPLES)
    print_summary(
        total_files=total_files,
        rows=rows,
        skipped=skipped,
        output_path=output_path,
        n_samples=DEFAULT_NUM_SAMPLES,
        alpha_threshold=DEFAULT_ALPHA_THRESHOLD,
    )


if __name__ == "__main__":
    main()
