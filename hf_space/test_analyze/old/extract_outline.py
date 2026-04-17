#!/usr/bin/env python3
"""
Extract outline images from mask PNGs using the same OpenCV flow as opencv-tests.ipynb:

1) threshold
2) erode + dilate
3) findContours
4) contour filtering by border touch + area ratio
5) draw valid contours

Default batch mode reads object IDs from test_assets/manual_interesting_ones.json and writes
outline PNGs + optional contour JSON for frontend usage.
"""

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image as PImage

DEFAULT_OBJECT_IDS_JSON = "test_assets/manual_interesting_ones.json"
DEFAULT_INPUT_DIR = "hf_space/pipeline/test_images"
DEFAULT_OUTPUT_DIR = "test_assets/outline_images"
DEFAULT_OUTPUT_JSON = "test_assets/outline_contours.json"

DEFAULT_THRESHOLD = 128
DEFAULT_ERODE_SIZE = 2
DEFAULT_DILATE_SIZE = 3
DEFAULT_MARGIN_PX = 1
DEFAULT_MIN_AREA_RATIO = 0.05
DEFAULT_MAX_AREA_RATIO = 0.80
DEFAULT_LINE_THICKNESS = 2

# Frontend outline color: solid white.
OUTLINE_COLOR_RGBA = (255, 255, 255, 255)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Extract outline images from standardized mask PNGs."
    )
    parser.add_argument(
        "--object-ids-json",
        default=DEFAULT_OBJECT_IDS_JSON,
        help=f"JSON array of object IDs (default: {DEFAULT_OBJECT_IDS_JSON}).",
    )
    parser.add_argument(
        "--input-dir",
        default=DEFAULT_INPUT_DIR,
        help=f"Directory containing *_mask_standardized.png files (default: {DEFAULT_INPUT_DIR}).",
    )
    parser.add_argument(
        "--output-dir",
        default=DEFAULT_OUTPUT_DIR,
        help=f"Where to write outline PNGs (default: {DEFAULT_OUTPUT_DIR}).",
    )
    parser.add_argument(
        "--output-json",
        default=DEFAULT_OUTPUT_JSON,
        help=f"Where to write contour points JSON (default: {DEFAULT_OUTPUT_JSON}).",
    )
    parser.add_argument(
        "--line-thickness",
        type=int,
        default=DEFAULT_LINE_THICKNESS,
        help=f"Contour line thickness in pixels (default: {DEFAULT_LINE_THICKNESS}).",
    )
    parser.add_argument(
        "--skip-json",
        action="store_true",
        help="Skip writing contour points JSON.",
    )
    return parser.parse_args()


def tocv(pil_image):
    return np.array(pil_image)


def topil(cv_image):
    return PImage.fromarray(cv_image)


def load_mask_grayscale(mask_path):
    """
    Read standardized mask as grayscale for thresholding.

    For RGBA masks, alpha channel is the most stable foreground channel.
    """
    pil_image = PImage.open(mask_path)
    if "A" in pil_image.getbands():
        return tocv(pil_image.getchannel("A"))
    return tocv(pil_image.convert("L"))


def contour_is_valid(
    contour,
    height,
    width,
    margin_px=DEFAULT_MARGIN_PX,
    min_area_ratio=DEFAULT_MIN_AREA_RATIO,
    max_area_ratio=DEFAULT_MAX_AREA_RATIO,
):
    # Reject contours touching image border.
    for point in contour:
        x, y = point[0]
        if (
            x < margin_px
            or x > width - margin_px - 1
            or y < margin_px
            or y > height - margin_px - 1
        ):
            return False

    area = cv2.contourArea(contour)
    image_area = height * width
    return (area < max_area_ratio * image_area) and (area > min_area_ratio * image_area)


def extract_outline_from_mask(
    mask_path,
    threshold_value=DEFAULT_THRESHOLD,
    erode_size=DEFAULT_ERODE_SIZE,
    dilate_size=DEFAULT_DILATE_SIZE,
    line_thickness=DEFAULT_LINE_THICKNESS,
):
    gray = load_mask_grayscale(mask_path)
    height, width = gray.shape

    # 1) Threshold
    _, img_thold = cv2.threshold(gray, threshold_value, 255, cv2.THRESH_BINARY)

    # 2) Erode + Dilate (same notebook structure/params)
    ekernel = cv2.getStructuringElement(
        cv2.MORPH_CROSS,
        (2 * erode_size + 1, 2 * erode_size + 1),
        (erode_size, erode_size),
    )
    dkernel = cv2.getStructuringElement(
        cv2.MORPH_CROSS,
        (2 * dilate_size + 1, 2 * dilate_size + 1),
        (dilate_size, dilate_size),
    )
    eroded = cv2.erode(img_thold, ekernel)
    dilated = cv2.dilate(eroded, dkernel)

    # 3) Find contours
    contours, _ = cv2.findContours(
        image=dilated,
        mode=cv2.RETR_TREE,
        method=cv2.CHAIN_APPROX_NONE,
    )

    # 4) Filter contours
    valid_contours = [con for con in contours if contour_is_valid(con, height, width)]

    # 5) Draw outlines on transparent RGBA canvas
    outline_rgba = np.zeros((height, width, 4), dtype=np.uint8)
    for contour in valid_contours:
        cv2.drawContours(
            outline_rgba,
            [contour],
            contourIdx=0,
            color=OUTLINE_COLOR_RGBA,
            thickness=line_thickness,
        )

    contour_points = [contour.squeeze().tolist() for contour in valid_contours if contour.size > 0]
    return topil(outline_rgba), contour_points


def load_object_ids(object_ids_json_path):
    data = json.loads(object_ids_json_path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"Expected JSON array at {object_ids_json_path}")
    # Deduplicate while preserving order.
    seen = set()
    ordered = []
    for value in data:
        text = str(value).strip()
        if not text or text in seen:
            continue
        seen.add(text)
        ordered.append(text)
    return ordered


def main():
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[2]

    object_ids_json_path = repo_root / args.object_ids_json
    input_dir = repo_root / args.input_dir
    output_dir = repo_root / args.output_dir
    output_json_path = repo_root / args.output_json

    object_ids = load_object_ids(object_ids_json_path)
    output_dir.mkdir(parents=True, exist_ok=True)

    contours_payload = {}
    processed = 0
    skipped = []

    for object_id in object_ids:
        mask_path = input_dir / f"{object_id}_mask_standardized.png"
        if not mask_path.exists():
            skipped.append((object_id, "mask not found"))
            continue

        try:
            outline_image, contour_points = extract_outline_from_mask(
                mask_path=mask_path,
                line_thickness=args.line_thickness,
            )
            outline_path = output_dir / f"{object_id}_outline.png"
            outline_image.save(outline_path)
            contours_payload[object_id] = contour_points
            processed += 1
        except Exception as error:
            skipped.append((object_id, str(error)))

    if not args.skip_json:
        payload = {
            "source_object_ids_json": args.object_ids_json,
            "input_dir": args.input_dir,
            "output_dir": args.output_dir,
            "processed_count": processed,
            "contours": contours_payload,
        }
        output_json_path.parent.mkdir(parents=True, exist_ok=True)
        output_json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print(f"processed={processed}")
    print(f"skipped={len(skipped)}")
    print(f"outline_output_dir={output_dir}")
    if not args.skip_json:
        print(f"contours_json={output_json_path}")
    if skipped:
        print("skipped_items:")
        for object_id, reason in skipped:
            print(f"- {object_id}: {reason}")


if __name__ == "__main__":
    main()
