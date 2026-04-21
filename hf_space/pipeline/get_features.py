import csv
import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

DEFAULT_NUM_SAMPLES = 64
DEFAULT_ALPHA_THRESHOLD = 16
MASK_GLOB = "*_mask.png"


def get_sample_positions(length, n_samples):
    if n_samples <= 0:
        raise ValueError("n_samples must be > 0")
    if length <= 0:
        raise ValueError("length must be > 0")
    if n_samples == 1:
        return [length // 2]
    return [round(i * (length - 1) / (n_samples - 1)) for i in range(n_samples)]


def extract_object_id(mask_path):
    name = mask_path.stem
    if name.endswith("_mask"):
        return name[: -len("_mask")]
    return name


def load_binary_mask(mask_path, alpha_threshold=DEFAULT_ALPHA_THRESHOLD):
    image = Image.open(mask_path)
    if "A" in image.getbands():
        channel = image.getchannel("A")
    else:
        channel = image.convert("L")

    channel_np = np.array(channel, dtype=np.uint8)
    binary = np.where(channel_np >= alpha_threshold, 255, 0).astype(np.uint8)
    return binary


def _row_distances(binary_mask, y):
    row = binary_mask[y, :]
    fg_indices = np.flatnonzero(row > 0)
    if fg_indices.size == 0:
        return math.nan, math.nan, False
    left = int(fg_indices[0])
    right = int(fg_indices[-1])
    width = binary_mask.shape[1]
    return left / width, ((width - 1) - right) / width, True


def _col_distances(binary_mask, x):
    col = binary_mask[:, x]
    fg_indices = np.flatnonzero(col > 0)
    if fg_indices.size == 0:
        return math.nan, math.nan, False
    top = int(fg_indices[0])
    bottom = int(fg_indices[-1])
    height = binary_mask.shape[0]
    return top / height, ((height - 1) - bottom) / height, True


def extract_profile_features(binary_mask, n_samples):
    height, width = binary_mask.shape
    row_positions = get_sample_positions(height, n_samples)
    col_positions = get_sample_positions(width, n_samples)

    record = {
        "valid_row_count": 0,
        "valid_col_count": 0,
    }
    left_values = []
    right_values = []

    for idx, y in enumerate(row_positions, start=1):
        left, right, valid = _row_distances(binary_mask, y)
        record[f"l{idx}"] = left
        record[f"r{idx}"] = right
        left_values.append(left)
        right_values.append(right)
        if valid:
            record["valid_row_count"] += 1

    for idx, x in enumerate(col_positions, start=1):
        top, bottom, valid = _col_distances(binary_mask, x)
        record[f"t{idx}"] = top
        record[f"b{idx}"] = bottom
        if valid:
            record["valid_col_count"] += 1

    lr_diffs = [
        abs(lv - rv)
        for lv, rv in zip(left_values, right_values)
        if not (math.isnan(lv) or math.isnan(rv))
    ]
    record["lr_profile_abs_diff_mean"] = float(np.mean(lr_diffs)) if lr_diffs else math.nan
    return record


def _safe_div(numerator, denominator):
    if denominator == 0:
        return math.nan
    return numerator / denominator


def _hu_log_transform(hu_values):
    transformed = []
    for value in hu_values:
        abs_value = abs(float(value))
        if abs_value < 1e-30:
            transformed.append(math.nan)
        else:
            transformed.append(-math.copysign(1.0, float(value)) * math.log10(abs_value))
    return transformed


def _eccentricity_from_moments(moments):
    m00 = moments.get("m00", 0.0)
    if m00 == 0:
        return math.nan
    mu20 = moments.get("mu20", 0.0) / m00
    mu02 = moments.get("mu02", 0.0) / m00
    mu11 = moments.get("mu11", 0.0) / m00
    cov = np.array([[mu20, mu11], [mu11, mu02]], dtype=float)
    eigenvalues = np.linalg.eigvalsh(cov)
    lambda1 = float(max(eigenvalues))
    lambda2 = float(min(eigenvalues))
    if lambda1 <= 0:
        return math.nan
    ratio = max(0.0, min(1.0, lambda2 / lambda1))
    return math.sqrt(1.0 - ratio)


def _width_ratio_top_bottom(binary_mask):
    height, _ = binary_mask.shape
    split = max(1, height // 2)
    top_rows = binary_mask[:split, :]
    bottom_rows = binary_mask[split:, :]

    def row_widths(mask_part):
        widths = []
        for row in mask_part:
            fg = np.flatnonzero(row > 0)
            if fg.size == 0:
                continue
            widths.append(float((fg[-1] - fg[0]) + 1))
        return widths

    top_widths = row_widths(top_rows)
    bottom_widths = row_widths(bottom_rows)
    if not top_widths or not bottom_widths:
        return math.nan
    return _safe_div(float(np.mean(top_widths)), float(np.mean(bottom_widths)))


def _interior_descendants(outer_index, hierarchy):
    interior_indices = []
    for idx in range(hierarchy.shape[0]):
        if idx == outer_index:
            continue
        parent = hierarchy[idx][3]
        while parent != -1:
            if parent == outer_index:
                interior_indices.append(idx)
                break
            parent = hierarchy[parent][3]
    return interior_indices


def extract_contour_features(binary_mask):
    contours, hierarchy = cv2.findContours(binary_mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_NONE)
    record = {}
    if not contours or hierarchy is None:
        record.update(
            {
                "contour_area": math.nan,
                "contour_area_norm": math.nan,
                "contour_perimeter": math.nan,
                "contour_perimeter_norm": math.nan,
                "contour_circularity": math.nan,
                "contour_extent": math.nan,
                "contour_aspect_ratio": math.nan,
                "contour_solidity": math.nan,
                "convexity_defect_count": math.nan,
                "convexity_defect_depth_sum": math.nan,
                "convexity_defect_depth_mean": math.nan,
                "convexity_defect_depth_max": math.nan,
                "eccentricity": math.nan,
                "upper_vs_lower_width_ratio": math.nan,
                "centroid_x_norm": math.nan,
                "centroid_offset_x": math.nan,
            }
        )
        for i in range(1, 8):
            record[f"hu{i}"] = math.nan
        for i in range(1, 4):
            record[f"inner{i}_area"] = math.nan
            record[f"inner{i}_perimeter"] = math.nan
            record[f"inner{i}_circularity"] = math.nan
        record.update(
            {
                "inner_count": 0,
                "inner_area_sum": math.nan,
                "inner_area_sum_norm": math.nan,
                "inner_area_ratio_to_outer": math.nan,
                "inner_area_mean": math.nan,
                "inner_area_mean_norm": math.nan,
                "inner_perimeter_sum": math.nan,
                "inner_perimeter_sum_norm": math.nan,
            }
        )
        return record

    hierarchy = hierarchy[0]
    outer_indices = [idx for idx, h in enumerate(hierarchy) if h[3] == -1]
    if not outer_indices:
        outer_indices = list(range(len(contours)))
    outer_idx = max(outer_indices, key=lambda idx: cv2.contourArea(contours[idx]))
    outer_contour = contours[outer_idx]

    area = float(cv2.contourArea(outer_contour))
    perimeter = float(cv2.arcLength(outer_contour, True))
    image_height, image_width = binary_mask.shape
    image_area = float(image_width * image_height)
    image_perimeter = float(2 * (image_width + image_height))
    circularity = _safe_div(4.0 * math.pi * area, perimeter * perimeter)
    x, y, w, h = cv2.boundingRect(outer_contour)
    extent = _safe_div(area, float(w * h))
    aspect_ratio = _safe_div(float(w), float(h))

    hull = cv2.convexHull(outer_contour)
    hull_area = float(cv2.contourArea(hull))
    solidity = _safe_div(area, hull_area)

    hull_idx = cv2.convexHull(outer_contour, returnPoints=False)
    defect_count = 0.0
    defect_sum = 0.0
    defect_max = 0.0
    if hull_idx is not None and len(hull_idx) >= 3 and len(outer_contour) >= 4:
        defects = cv2.convexityDefects(outer_contour, hull_idx)
        if defects is not None and len(defects) > 0:
            depths = defects[:, 0, 3].astype(float) / 256.0
            defect_count = float(len(depths))
            defect_sum = float(np.sum(depths))
            defect_max = float(np.max(depths))
    defect_mean = _safe_div(defect_sum, defect_count) if defect_count > 0 else 0.0

    moments = cv2.moments(outer_contour)
    hu = cv2.HuMoments(moments).flatten()
    hu_log = _hu_log_transform(hu)
    eccentricity = _eccentricity_from_moments(moments)

    m00 = moments.get("m00", 0.0)
    centroid_x = _safe_div(moments.get("m10", 0.0), m00) if m00 else math.nan
    width = binary_mask.shape[1]
    centroid_x_norm = (
        _safe_div(centroid_x, float(width)) if not math.isnan(centroid_x) else math.nan
    )
    centroid_offset_x = abs(centroid_x_norm - 0.5) if not math.isnan(centroid_x_norm) else math.nan

    interior_indices = _interior_descendants(outer_idx, hierarchy)
    interior_contours = [contours[idx] for idx in interior_indices]
    interior_contours.sort(key=cv2.contourArea, reverse=True)

    inner_areas = [float(cv2.contourArea(c)) for c in interior_contours]
    inner_perimeters = [float(cv2.arcLength(c, True)) for c in interior_contours]

    record.update(
        {
            "contour_area": area,
            "contour_area_norm": _safe_div(area, image_area),
            "contour_perimeter": perimeter,
            "contour_perimeter_norm": _safe_div(perimeter, image_perimeter),
            "contour_circularity": circularity,
            "contour_extent": extent,
            "contour_aspect_ratio": aspect_ratio,
            "contour_solidity": solidity,
            "convexity_defect_count": defect_count,
            "convexity_defect_depth_sum": defect_sum,
            "convexity_defect_depth_mean": defect_mean,
            "convexity_defect_depth_max": defect_max,
            "eccentricity": eccentricity,
            "upper_vs_lower_width_ratio": _width_ratio_top_bottom(binary_mask),
            "centroid_x_norm": centroid_x_norm,
            "centroid_offset_x": centroid_offset_x,
        }
    )
    for i, value in enumerate(hu_log, start=1):
        record[f"hu{i}"] = value

    for idx in range(3):
        if idx < len(interior_contours):
            area_i = inner_areas[idx]
            perimeter_i = inner_perimeters[idx]
            circularity_i = _safe_div(4.0 * math.pi * area_i, perimeter_i * perimeter_i)
            record[f"inner{idx + 1}_area"] = area_i
            record[f"inner{idx + 1}_perimeter"] = perimeter_i
            record[f"inner{idx + 1}_circularity"] = circularity_i
        else:
            record[f"inner{idx + 1}_area"] = math.nan
            record[f"inner{idx + 1}_perimeter"] = math.nan
            record[f"inner{idx + 1}_circularity"] = math.nan

    inner_count = len(interior_contours)
    inner_area_sum = float(np.sum(inner_areas)) if inner_areas else 0.0
    inner_perimeter_sum = float(np.sum(inner_perimeters)) if inner_perimeters else 0.0

    record["inner_count"] = inner_count
    record["inner_area_sum"] = inner_area_sum
    record["inner_area_sum_norm"] = _safe_div(inner_area_sum, image_area)
    record["inner_area_ratio_to_outer"] = _safe_div(inner_area_sum, area)
    record["inner_area_mean"] = _safe_div(inner_area_sum, float(inner_count))
    record["inner_area_mean_norm"] = _safe_div(record["inner_area_mean"], image_area)
    record["inner_perimeter_sum"] = inner_perimeter_sum
    record["inner_perimeter_sum_norm"] = _safe_div(inner_perimeter_sum, image_perimeter)
    return record


def extract_features_for_mask(
    mask_path,
    n_samples=DEFAULT_NUM_SAMPLES,
    alpha_threshold=DEFAULT_ALPHA_THRESHOLD,
):
    binary_mask = load_binary_mask(mask_path, alpha_threshold=alpha_threshold)
    if not np.any(binary_mask):
        raise ValueError("Mask has no foreground pixels.")

    height, width = binary_mask.shape
    bbox = Image.fromarray(binary_mask).getbbox()

    record = {
        "object_id": extract_object_id(mask_path),
        "mask_width": width,
        "mask_height": height,
        "bbox_left": bbox[0] if bbox else math.nan,
        "bbox_top": bbox[1] if bbox else math.nan,
        "bbox_right": bbox[2] if bbox else math.nan,
        "bbox_bottom": bbox[3] if bbox else math.nan,
    }
    record.update(extract_profile_features(binary_mask, n_samples=n_samples))
    record.update(extract_contour_features(binary_mask))
    return record


def get_feature_fieldnames(n_samples=DEFAULT_NUM_SAMPLES):
    fieldnames = [
        "object_id",
        "mask_width",
        "mask_height",
        "bbox_left",
        "bbox_top",
        "bbox_right",
        "bbox_bottom",
        "valid_row_count",
        "valid_col_count",
        "lr_profile_abs_diff_mean",
    ]
    fieldnames.extend([f"l{i}" for i in range(1, n_samples + 1)])
    fieldnames.extend([f"r{i}" for i in range(1, n_samples + 1)])
    fieldnames.extend([f"t{i}" for i in range(1, n_samples + 1)])
    fieldnames.extend([f"b{i}" for i in range(1, n_samples + 1)])
    fieldnames.extend(
        [
            "contour_area",
            "contour_area_norm",
            "contour_perimeter",
            "contour_perimeter_norm",
            "contour_circularity",
            "contour_extent",
            "contour_aspect_ratio",
            "contour_solidity",
            "convexity_defect_count",
            "convexity_defect_depth_sum",
            "convexity_defect_depth_mean",
            "convexity_defect_depth_max",
            "eccentricity",
            "upper_vs_lower_width_ratio",
            "centroid_x_norm",
            "centroid_offset_x",
        ]
    )
    fieldnames.extend([f"hu{i}" for i in range(1, 8)])
    fieldnames.extend(
        [
            "inner1_area",
            "inner1_perimeter",
            "inner1_circularity",
            "inner2_area",
            "inner2_perimeter",
            "inner2_circularity",
            "inner3_area",
            "inner3_perimeter",
            "inner3_circularity",
            "inner_count",
            "inner_area_sum",
            "inner_area_sum_norm",
            "inner_area_ratio_to_outer",
            "inner_area_mean",
            "inner_area_mean_norm",
            "inner_perimeter_sum",
            "inner_perimeter_sum_norm",
        ]
    )
    return fieldnames


def build_feature_table(
    input_dir,
    n_samples=DEFAULT_NUM_SAMPLES,
    alpha_threshold=DEFAULT_ALPHA_THRESHOLD,
    max_files=None,
):
    mask_paths = sorted(Path(input_dir).glob(MASK_GLOB))
    if max_files is not None:
        mask_paths = mask_paths[:max_files]

    rows = []
    skipped = []
    for mask_path in mask_paths:
        try:
            row = extract_features_for_mask(
                mask_path=mask_path,
                n_samples=n_samples,
                alpha_threshold=alpha_threshold,
            )
            rows.append(row)
        except Exception as error:
            skipped.append(
                {
                    "object_id": extract_object_id(mask_path),
                    "file": mask_path.name,
                    "error": str(error),
                }
            )
    return rows, skipped, len(mask_paths)


def write_feature_csv(rows, output_path, n_samples=DEFAULT_NUM_SAMPLES):
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = get_feature_fieldnames(n_samples=n_samples)

    with output_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_skipped_jsonl(skipped, skipped_log_path):
    skipped_log_path = Path(skipped_log_path)
    skipped_log_path.parent.mkdir(parents=True, exist_ok=True)
    with skipped_log_path.open("w", encoding="utf-8") as file:
        for item in skipped:
            file.write(json.dumps(item) + "\n")


def run_feature_extraction(
    input_dir=None,
    output_path=None,
    skipped_log_path=None,
    n_samples=DEFAULT_NUM_SAMPLES,
    alpha_threshold=DEFAULT_ALPHA_THRESHOLD,
    max_files=None,
):
    pipeline_dir = Path(__file__).resolve().parent
    resolved_input_dir = Path(input_dir) if input_dir else (pipeline_dir / "real_images")
    resolved_output_path = (
        Path(output_path)
        if output_path
        else (pipeline_dir / "features" / "silhouette_features.csv")
    )
    resolved_skipped_log_path = (
        Path(skipped_log_path)
        if skipped_log_path
        else (pipeline_dir / "features" / "skipped_features.jsonl")
    )

    rows, skipped, total_files = build_feature_table(
        input_dir=resolved_input_dir,
        n_samples=n_samples,
        alpha_threshold=alpha_threshold,
        max_files=max_files,
    )
    write_feature_csv(rows=rows, output_path=resolved_output_path, n_samples=n_samples)
    write_skipped_jsonl(skipped=skipped, skipped_log_path=resolved_skipped_log_path)
    summary = {
        "input_dir": str(resolved_input_dir),
        "output_path": str(resolved_output_path),
        "skipped_log_path": str(resolved_skipped_log_path),
        "total_files_seen": total_files,
        "rows_written": len(rows),
        "skipped_count": len(skipped),
        "skipped": skipped,
    }
    return summary


def main():
    summary = run_feature_extraction()
    print("Feature extraction complete.")
    print(f"- input_dir: {summary['input_dir']}")
    print(f"- output_path: {summary['output_path']}")
    print(f"- skipped_log_path: {summary['skipped_log_path']}")
    print(f"- total mask files seen: {summary['total_files_seen']}")
    print(f"- rows written: {summary['rows_written']}")
    print(f"- skipped: {summary['skipped_count']}")
    if summary["skipped"]:
        print("- skipped samples:")
        for item in summary["skipped"][:20]:
            print(f"  - {item['file']}: {item['error']}")


if __name__ == "__main__":
    main()
