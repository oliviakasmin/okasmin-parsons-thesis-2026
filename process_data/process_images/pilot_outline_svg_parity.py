from __future__ import annotations

import argparse
import csv
import io
import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import cv2
import numpy as np
from PIL import Image

from extract_mask_contours import extract_outline_from_mask_image

REPO_ROOT = Path(__file__).resolve().parents[2]
S3_REAL_IMAGES_BASE_URL = "https://vessels-thesis.s3.amazonaws.com/real_images"
DEFAULT_CLUSTER_OBJECT_IDS_CSV = REPO_ROOT / "process_data/cluster/final_clusters_object_ids.csv"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "process_data/generated/svg_parity"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate one outline SVG and compare parity with existing outline PNG."
    )
    parser.add_argument(
        "--object-id",
        default="",
        help="Optional explicit objectID. If omitted, auto-select first valid candidate.",
    )
    parser.add_argument(
        "--candidates-csv",
        default=str(DEFAULT_CLUSTER_OBJECT_IDS_CSV),
        help=f"CSV with object_id column for auto selection (default: {DEFAULT_CLUSTER_OBJECT_IDS_CSV}).",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help=f"Output directory for pilot artifacts (default: {DEFAULT_OUTPUT_DIR}).",
    )
    return parser.parse_args()


def _fetch_bytes(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=30) as response:
        return response.read()


def _url_exists(url: str) -> bool:
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"}, method="HEAD")
    try:
        with urlopen(request, timeout=15):
            return True
    except HTTPError as err:
        if err.code in (403, 404):
            return False
        return False
    except URLError:
        return False


def _load_object_ids(candidates_csv: Path) -> list[str]:
    ids: list[str] = []
    with candidates_csv.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            value = str(row.get("object_id", "")).strip()
            if value:
                ids.append(value)
    return ids


def _asset_urls(object_id: str) -> tuple[str, str]:
    mask_url = f"{S3_REAL_IMAGES_BASE_URL}/{object_id}_mask.png"
    outline_url = f"{S3_REAL_IMAGES_BASE_URL}/{object_id}_outline.png"
    return mask_url, outline_url


def _pick_representative_object_id(explicit_object_id: str, candidates_csv: Path) -> str:
    if explicit_object_id:
        object_id = explicit_object_id.strip()
        mask_url, outline_url = _asset_urls(object_id)
        if _url_exists(mask_url) and _url_exists(outline_url):
            return object_id
        raise RuntimeError(f"Provided object_id has missing S3 assets: {object_id}")

    for object_id in _load_object_ids(candidates_csv):
        mask_url, outline_url = _asset_urls(object_id)
        if _url_exists(mask_url) and _url_exists(outline_url):
            return object_id

    raise RuntimeError("Could not find an object_id with both mask and outline assets on S3.")


def _contour_path_d(contours: list[np.ndarray]) -> str:
    commands: list[str] = []
    for contour in contours:
        points = contour.reshape(-1, 2)
        if points.shape[0] < 2:
            continue
        first_x, first_y = points[0]
        commands.append(f"M {int(first_x)} {int(first_y)}")
        for x, y in points[1:]:
            commands.append(f"L {int(x)} {int(y)}")
        commands.append("Z")
    return " ".join(commands)


def _write_svg_from_contours(contours: list[np.ndarray], width: int, height: int, output_path: Path) -> None:
    path_d = _contour_path_d(contours)
    svg = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" preserveAspectRatio="xMidYMid meet">\n'
        '  <g fill="none" stroke="#ffffff" stroke-width="1" stroke-linejoin="round" stroke-linecap="round">\n'
        f'    <path d="{path_d}" />\n'
        "  </g>\n"
        "</svg>\n"
    )
    output_path.write_text(svg, encoding="utf-8")


def _draw_contours_binary(contours: list[np.ndarray], width: int, height: int) -> np.ndarray:
    canvas = np.zeros((height, width), dtype=np.uint8)
    if contours:
        cv2.drawContours(canvas, contours, -1, color=255, thickness=1)
    return canvas


def _alpha_from_outline_rgba(outline_rgba: np.ndarray) -> np.ndarray:
    if outline_rgba.shape[2] == 4:
        return outline_rgba[:, :, 3]
    gray = cv2.cvtColor(outline_rgba, cv2.COLOR_RGB2GRAY)
    _, binary = cv2.threshold(gray, 1, 255, cv2.THRESH_BINARY)
    return binary


def _bbox(binary: np.ndarray) -> list[int] | None:
    ys, xs = np.where(binary > 0)
    if xs.size == 0 or ys.size == 0:
        return None
    return [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]


def _make_overlay_png(existing_outline_alpha: np.ndarray, generated_outline_alpha: np.ndarray) -> Image.Image:
    h, w = existing_outline_alpha.shape
    overlay = np.zeros((h, w, 4), dtype=np.uint8)

    existing_on = existing_outline_alpha > 0
    generated_on = generated_outline_alpha > 0

    overlap = existing_on & generated_on
    existing_only = existing_on & ~generated_on
    generated_only = generated_on & ~existing_on

    overlay[overlap] = (255, 255, 255, 255)
    overlay[existing_only] = (255, 0, 0, 255)
    overlay[generated_only] = (0, 255, 255, 255)
    return Image.fromarray(overlay, mode="RGBA")


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    candidates_csv = Path(args.candidates_csv)

    object_id = _pick_representative_object_id(args.object_id, candidates_csv)
    mask_url, outline_url = _asset_urls(object_id)

    mask_image = Image.open(io.BytesIO(_fetch_bytes(mask_url))).convert("RGBA")
    outline_image = Image.open(io.BytesIO(_fetch_bytes(outline_url))).convert("RGBA")

    contours, _, _, _ = extract_outline_from_mask_image(mask_image)
    width, height = mask_image.size

    svg_path = output_dir / f"{object_id}_outline.svg"
    _write_svg_from_contours(contours=contours, width=width, height=height, output_path=svg_path)

    generated_alpha = _draw_contours_binary(contours=contours, width=width, height=height)
    outline_rgba = np.array(outline_image, dtype=np.uint8)
    existing_alpha = _alpha_from_outline_rgba(outline_rgba)

    overlay_image = _make_overlay_png(existing_alpha, generated_alpha)
    overlay_path = output_dir / f"{object_id}_outline_parity_overlay.png"
    overlay_image.save(overlay_path, format="PNG")

    report = {
        "object_id": object_id,
        "mask_url": mask_url,
        "outline_png_url": outline_url,
        "generated_svg_path": str(svg_path),
        "overlay_path": str(overlay_path),
        "canvas_size": {"width": width, "height": height},
        "existing_outline_bbox": _bbox(existing_alpha),
        "generated_outline_bbox": _bbox(generated_alpha),
        "legend": {
            "white": "overlap",
            "red": "existing PNG only",
            "cyan": "generated contour only",
        },
    }
    report_path = output_dir / f"{object_id}_outline_parity_report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
