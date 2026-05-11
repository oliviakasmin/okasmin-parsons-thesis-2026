from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from ..bw_detection import check_image_url_grayscale
from .pixel_snapped_palette import extract_pixel_snapped_palette

ROOT = Path(__file__).resolve().parents[3]
OBJECTS_JSON_PATH = ROOT / "fetch_data" / "data" / "objects.json"
REAL_IMAGES_DIR = ROOT / "process_data" / "generated" / "real_images"
GENERATED_COLOR_DIR = ROOT / "format_data" / "generated" / "color"
OUTPUT_CSV_PATH = GENERATED_COLOR_DIR / "object_color_fields_new.csv"
RUN_STATS_PATH = GENERATED_COLOR_DIR / "object_color_new_run_stats.json"
BW_CACHE_PATH = GENERATED_COLOR_DIR / "color_bw_cache.csv"
MANUAL_BW_GROUPS_PATH = ROOT / "format_data" / "color" / "new" / "new_color_groups.json"
MANUAL_BW_GROUP_NAME = "b_w_images_to_filter"
OUTPUT_COLUMNS = [
    "objectID",
    "color_eligible",
    "color_analysis_status",
    "primary_image_url",
    "bw_grayscale_ratio",
    "top_color_hex",
    "dominant_colors_hex",
    "dominant_colors_share",
    "dominant_color_foreground_pixels",
    "no_bg_image_path",
    "no_bg_image_exists",
    "colorgram_palette_hex",
    "colorgram_palette_share",
    "colorgram_palette_rgb",
    "colorgram_palette_hsl",
    "colorgram_dominant_hex",
    "colorgram_dominant_share",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build post-BW no-bg color fields (new pipeline).")
    parser.add_argument("--max-objects", type=int, default=None, help="Optional cap for smoke runs.")
    parser.add_argument("--start-index", type=int, default=None, help="Inclusive start row index after sorting.")
    parser.add_argument("--end-index", type=int, default=None, help="Inclusive end row index after sorting.")
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip objectIDs already present in object_color_fields_new.csv.",
    )
    parser.add_argument("--dominant-count", type=int, default=8, help="Number of dominant colors to keep.")
    parser.add_argument("--refresh-bw-cache", action="store_true", help="Ignore cached URL grayscale checks.")
    parser.add_argument(
        "--progress-every",
        type=int,
        default=25,
        help="Print progress every N processed objects (0 disables periodic progress logs).",
    )
    return parser.parse_args()


def _load_objects(
    path: Path,
    max_objects: int | None = None,
    start_index: int | None = None,
    end_index: int | None = None,
) -> list[dict]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    rows = []
    for obj in raw.values():
        object_id = obj.get("objectID")
        if object_id is None:
            continue
        object_id = int(object_id)
        rows.append({"objectID": int(object_id), "primaryImage": (obj.get("primaryImage") or "").strip()})
    rows.sort(key=lambda item: item["objectID"])
    if start_index is not None or end_index is not None:
        start = 0 if start_index is None else max(0, start_index)
        end = len(rows) - 1 if end_index is None else min(len(rows) - 1, end_index)
        if end < start:
            return []
        rows = rows[start : end + 1]
    if max_objects is not None:
        rows = rows[:max_objects]
    return rows


def _load_bw_cache(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    out: dict[str, dict] = {}
    with path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            image_url = (row.get("image_url") or "").strip()
            if image_url:
                out[image_url] = row
    return out


def _load_manual_bw_original_ids(path: Path) -> set[int]:
    if not path.exists():
        return set()
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        return set()
    values = raw.get(MANUAL_BW_GROUP_NAME)
    if not isinstance(values, list):
        return set()

    out: set[int] = set()
    for value in values:
        if isinstance(value, bool):
            continue
        if isinstance(value, int):
            out.add(int(value))
        elif isinstance(value, float) and value.is_integer():
            out.add(int(value))
        elif isinstance(value, str) and value.strip().isdigit():
            out.add(int(value.strip()))
    return out


def _save_bw_cache(path: Path, cache: dict[str, dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["image_url", "is_grayscale", "grayscale_ratio", "sampled_pixels", "error", "checked_at"]
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for key in sorted(cache.keys()):
            writer.writerow(cache[key])


def _bw_check(image_url: str, cache: dict[str, dict], refresh: bool) -> tuple[bool | None, float | None, str]:
    if (not refresh) and image_url in cache:
        cached = cache[image_url]
        error = (cached.get("error") or "").strip()
        if error:
            return None, None, error
        return cached.get("is_grayscale") == "true", float(cached.get("grayscale_ratio") or 0.0), ""

    checked_at = datetime.now(timezone.utc).isoformat()
    try:
        result = check_image_url_grayscale(image_url=image_url)
    except Exception as error:  # noqa: BLE001
        cache[image_url] = {
            "image_url": image_url,
            "is_grayscale": "",
            "grayscale_ratio": "",
            "sampled_pixels": "",
            "error": str(error),
            "checked_at": checked_at,
        }
        return None, None, str(error)

    cache[image_url] = {
        "image_url": image_url,
        "is_grayscale": "true" if result.is_grayscale else "false",
        "grayscale_ratio": f"{result.grayscale_ratio:.8f}",
        "sampled_pixels": str(result.sampled_pixels),
        "error": "",
        "checked_at": checked_at,
    }
    return result.is_grayscale, result.grayscale_ratio, ""


def _no_bg_path(object_id: int) -> Path:
    return REAL_IMAGES_DIR / f"{object_id}_no_bg.png"


def _load_existing_rows(path: Path) -> dict[int, dict]:
    if not path.exists():
        return {}
    df = pd.read_csv(path)
    if "objectID" not in df.columns:
        return {}
    rows: dict[int, dict] = {}
    for row in df.to_dict(orient="records"):
        object_id = row.get("objectID")
        if pd.isna(object_id):
            continue
        rows[int(object_id)] = row
    return rows


def run_pipeline(
    max_objects: int | None = None,
    start_index: int | None = None,
    end_index: int | None = None,
    skip_existing: bool = False,
    dominant_count: int = 8,
    refresh_bw_cache: bool = False,
    progress_every: int = 25,
) -> dict:
    objects = _load_objects(
        path=OBJECTS_JSON_PATH,
        max_objects=max_objects,
        start_index=start_index,
        end_index=end_index,
    )
    bw_cache = _load_bw_cache(path=BW_CACHE_PATH)
    manual_bw_original_ids = _load_manual_bw_original_ids(path=MANUAL_BW_GROUPS_PATH)
    existing_rows = _load_existing_rows(path=OUTPUT_CSV_PATH)
    processed_count = 0

    rows: list[dict] = []
    selected_total = len(objects)
    for selected_idx, obj in enumerate(objects, start=1):
        object_id = obj["objectID"]
        if skip_existing and object_id in existing_rows and object_id not in manual_bw_original_ids:
            if progress_every > 0 and (selected_idx % progress_every == 0 or selected_idx == selected_total):
                print(
                    "[progress] "
                    f"selected={selected_idx}/{selected_total} "
                    f"processed_now={processed_count} "
                    f"skipped_existing={selected_idx - processed_count} "
                    f"last_object_id={object_id}"
                )
            continue
        processed_count += 1
        image_url = obj["primaryImage"]
        row = {
            "objectID": object_id,
            "color_eligible": False,
            "color_analysis_status": "",
            "primary_image_url": image_url,
            "bw_grayscale_ratio": "",
            "top_color_hex": "",
            "dominant_colors_hex": json.dumps([]),
            "dominant_colors_share": json.dumps([]),
            "dominant_color_foreground_pixels": "",
            "no_bg_image_path": str(_no_bg_path(object_id)),
            "no_bg_image_exists": False,
            "colorgram_palette_hex": json.dumps([]),
            "colorgram_palette_share": json.dumps([]),
            "colorgram_palette_rgb": json.dumps([]),
            "colorgram_palette_hsl": json.dumps([]),
            "colorgram_dominant_hex": "",
            "colorgram_dominant_share": "",
        }

        if not image_url:
            row["color_analysis_status"] = "missing_primary_image"
            rows.append(row)
            continue

        if object_id in manual_bw_original_ids:
            row["color_analysis_status"] = "bw_original"
            row["bw_grayscale_ratio"] = "1.00000000"
            rows.append(row)
            continue

        is_grayscale, grayscale_ratio, bw_error = _bw_check(image_url=image_url, cache=bw_cache, refresh=refresh_bw_cache)
        if bw_error:
            row["color_analysis_status"] = "url_fetch_error"
            rows.append(row)
            continue
        if grayscale_ratio is not None:
            row["bw_grayscale_ratio"] = f"{grayscale_ratio:.8f}"

        row["color_eligible"] = bool(is_grayscale is False)
        if is_grayscale:
            row["color_analysis_status"] = "bw_original"
            rows.append(row)
            continue

        image_path = _no_bg_path(object_id)
        row["no_bg_image_exists"] = image_path.exists()
        if not image_path.exists():
            row["color_analysis_status"] = "missing_no_bg"
            rows.append(row)
            continue

        try:
            result = extract_pixel_snapped_palette(image_path=image_path, n_colors=dominant_count)
            row["top_color_hex"] = result.colorgram_dominant_hex
            row["dominant_colors_hex"] = json.dumps(result.colors_hex)
            row["dominant_colors_share"] = json.dumps([round(value, 8) for value in result.shares])
            row["dominant_color_foreground_pixels"] = result.foreground_pixels
            row["colorgram_palette_hex"] = json.dumps(result.colorgram_palette_hex)
            row["colorgram_palette_share"] = json.dumps([round(value, 8) for value in result.colorgram_palette_share])
            row["colorgram_palette_rgb"] = json.dumps(result.colorgram_palette_rgb)
            row["colorgram_palette_hsl"] = json.dumps(result.colorgram_palette_hsl)
            row["colorgram_dominant_hex"] = result.colorgram_dominant_hex
            row["colorgram_dominant_share"] = round(result.colorgram_dominant_share, 8)
            row["color_analysis_status"] = "eligible"
        except Exception as error:  # noqa: BLE001
            row["color_analysis_status"] = f"palette_error:{error}"

        rows.append(row)
        if progress_every > 0 and (selected_idx % progress_every == 0 or selected_idx == selected_total):
            print(
                "[progress] "
                f"selected={selected_idx}/{selected_total} "
                f"processed_now={processed_count} "
                f"skipped_existing={selected_idx - processed_count} "
                f"last_object_id={object_id} "
                f"last_status={row['color_analysis_status']}"
            )

    _save_bw_cache(path=BW_CACHE_PATH, cache=bw_cache)

    for row in rows:
        existing_rows[int(row["objectID"])] = row

    output_df = pd.DataFrame(existing_rows.values())
    for col in OUTPUT_COLUMNS:
        if col not in output_df.columns:
            output_df[col] = ""
    output_df = output_df[OUTPUT_COLUMNS].sort_values("objectID").reset_index(drop=True)
    GENERATED_COLOR_DIR.mkdir(parents=True, exist_ok=True)
    output_df.to_csv(OUTPUT_CSV_PATH, index=False)

    stats = {
        "objects_selected": int(len(objects)),
        "objects_processed_this_run": int(processed_count),
        "rows_written": int(len(output_df)),
        "eligible_with_palette": int((output_df["color_analysis_status"] == "eligible").sum()),
        "bw_original_count": int((output_df["color_analysis_status"] == "bw_original").sum()),
        "missing_no_bg_count": int((output_df["color_analysis_status"] == "missing_no_bg").sum()),
        "output_csv_path": str(OUTPUT_CSV_PATH),
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    }
    RUN_STATS_PATH.write_text(json.dumps(stats, indent=2), encoding="utf-8")
    return stats


def main() -> None:
    args = parse_args()
    if args.start_index is not None and args.start_index < 0:
        raise ValueError("--start-index must be >= 0")
    if args.end_index is not None and args.end_index < 0:
        raise ValueError("--end-index must be >= 0")
    if args.start_index is not None and args.end_index is not None and args.start_index > args.end_index:
        raise ValueError("--start-index must be <= --end-index")
    stats = run_pipeline(
        max_objects=args.max_objects,
        start_index=args.start_index,
        end_index=args.end_index,
        skip_existing=args.skip_existing,
        dominant_count=args.dominant_count,
        refresh_bw_cache=args.refresh_bw_cache,
        progress_every=args.progress_every,
    )
    print(f"Saved color fields to {stats['output_csv_path']}")
    print(
        "objects_selected="
        f"{stats['objects_selected']} "
        f"processed_now={stats['objects_processed_this_run']} "
        f"rows_written={stats['rows_written']} "
        f"eligible={stats['eligible_with_palette']}"
    )


if __name__ == "__main__":
    main()

