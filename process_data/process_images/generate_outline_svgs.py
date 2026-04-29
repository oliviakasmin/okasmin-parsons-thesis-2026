from __future__ import annotations

import argparse
import csv
import io
import json
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from PIL import Image

from extract_mask_contours import extract_outline_from_mask_image

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CLUSTER_OBJECT_IDS_CSV = REPO_ROOT / "process_data/cluster/final_clusters_object_ids.csv"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "process_data/generated/real_images"
DEFAULT_ERRORS_PATH = REPO_ROOT / "process_data/generated/outline_svg_errors.jsonl"
S3_REAL_IMAGES_BASE_URL = "https://vessels-thesis.s3.amazonaws.com/real_images"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate per-object outline SVG files from standardized mask PNGs."
    )
    parser.add_argument(
        "--candidates-csv",
        default=str(DEFAULT_CLUSTER_OBJECT_IDS_CSV),
        help=f"CSV containing object_id column (default: {DEFAULT_CLUSTER_OBJECT_IDS_CSV}).",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help=f"Directory for { '{object_id}_outline.svg' } files (default: {DEFAULT_OUTPUT_DIR}).",
    )
    parser.add_argument(
        "--error-log",
        default=str(DEFAULT_ERRORS_PATH),
        help=f"JSONL path for per-object errors (default: {DEFAULT_ERRORS_PATH}).",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip object IDs that already have an outline SVG in output-dir.",
    )
    parser.add_argument(
        "--start-index",
        type=int,
        default=0,
        help="Start index over candidate object IDs (default: 0).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Max number of objects after start-index (0 = all).",
    )
    parser.add_argument(
        "--max-errors",
        type=int,
        default=200,
        help="Stop after this many errors (default: 200).",
    )
    return parser.parse_args()


def _load_object_ids(candidates_csv: Path) -> list[str]:
    ids: list[str] = []
    seen: set[str] = set()
    with candidates_csv.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            object_id = str(row.get("object_id", "")).strip()
            if not object_id or object_id in seen:
                continue
            seen.add(object_id)
            ids.append(object_id)
    return ids


def _fetch_mask_image(object_id: str) -> Image.Image:
    mask_url = f"{S3_REAL_IMAGES_BASE_URL}/{object_id}_mask.png"
    request = Request(mask_url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=30) as response:
        image_bytes = response.read()
    return Image.open(io.BytesIO(image_bytes)).convert("RGBA")


def _contour_path_d(contours) -> str:
    commands: list[str] = []
    for contour in contours:
        points = contour.reshape(-1, 2)
        if points.shape[0] < 2:
            continue
        x0, y0 = points[0]
        commands.append(f"M {int(x0)} {int(y0)}")
        for x, y in points[1:]:
            commands.append(f"L {int(x)} {int(y)}")
        commands.append("Z")
    return " ".join(commands)


def _write_outline_svg(mask_image: Image.Image, contours, output_path: Path) -> None:
    width, height = mask_image.size
    path_d = _contour_path_d(contours)
    svg = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" preserveAspectRatio="xMidYMid meet">\n'
        '  <g fill="none" stroke="#ffffff" stroke-width="1" '
        'stroke-linejoin="round" stroke-linecap="round">\n'
        f'    <path d="{path_d}" />\n'
        "  </g>\n"
        "</svg>\n"
    )
    output_path.write_text(svg, encoding="utf-8")


def main() -> None:
    args = parse_args()
    candidates_csv = Path(args.candidates_csv)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    error_log = Path(args.error_log)
    error_log.parent.mkdir(parents=True, exist_ok=True)

    object_ids = _load_object_ids(candidates_csv)
    total = len(object_ids)
    start = max(args.start_index, 0)
    end = total if args.limit <= 0 else min(total, start + args.limit)
    selected = object_ids[start:end]

    generated = 0
    skipped_existing = 0
    errors = 0
    t0 = time.time()

    print(f"total_candidates={total}")
    print(f"selected_range=[{start}:{end}]")
    print(f"selected_count={len(selected)}")
    print(f"output_dir={output_dir}")

    for index, object_id in enumerate(selected, start=1):
        svg_path = output_dir / f"{object_id}_outline.svg"

        if args.skip_existing and svg_path.exists():
            skipped_existing += 1
            continue

        try:
            mask_image = _fetch_mask_image(object_id)
            contours, _, _, _ = extract_outline_from_mask_image(mask_image)
            _write_outline_svg(mask_image=mask_image, contours=contours, output_path=svg_path)
            generated += 1
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as error:
            errors += 1
            record = {
                "object_id": object_id,
                "error_type": type(error).__name__,
                "error": str(error),
            }
            with error_log.open("a", encoding="utf-8") as file:
                file.write(json.dumps(record) + "\n")
            if errors >= args.max_errors:
                print(f"max_errors_reached={args.max_errors}")
                break

        if index % 100 == 0:
            elapsed = time.time() - t0
            print(
                "progress="
                f"{index}/{len(selected)} generated={generated} "
                f"skipped_existing={skipped_existing} errors={errors} elapsed_s={elapsed:.1f}"
            )

    elapsed = time.time() - t0
    print(
        "done "
        f"generated={generated} skipped_existing={skipped_existing} "
        f"errors={errors} elapsed_s={elapsed:.1f}"
    )
    print(f"error_log={error_log}")


if __name__ == "__main__":
    main()
