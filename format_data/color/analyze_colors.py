from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from .bw_detection import check_image_url_grayscale
from .dominant_colors import extract_dominant_colors
from .recluster_colors import run_reclustering

ROOT = Path(__file__).resolve().parents[2]
OBJECTS_JSON_PATH = ROOT / "fetch_data" / "data" / "objects.json"
REAL_IMAGES_DIR = ROOT / "process_data" / "generated" / "real_images"
GENERATED_DIR = ROOT / "format_data" / "generated"
COLOR_GENERATED_DIR = GENERATED_DIR / "color"
OUTPUT_CSV_PATH = COLOR_GENERATED_DIR / "object_color_fields.csv"
CLUSTER_SUMMARY_PATH = COLOR_GENERATED_DIR / "object_color_cluster_centroids.csv"
RUN_STATS_PATH = COLOR_GENERATED_DIR / "object_color_run_stats.json"
BW_CACHE_PATH = COLOR_GENERATED_DIR / "color_bw_cache.csv"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze object image colors and cluster color groups.")
    parser.add_argument("--max-objects", type=int, default=None, help="Optional cap for smoke runs.")
    parser.add_argument("--dominant-count", type=int, default=8, help="Number of dominant colors to keep.")
    parser.add_argument("--max-groups", type=int, default=10, help="Maximum number of color groups.")
    parser.add_argument("--refresh-bw-cache", action="store_true", help="Ignore cached URL grayscale checks.")
    return parser.parse_args()


def _load_objects(path: Path, max_objects: int | None = None) -> list[dict]:
    with path.open("r", encoding="utf-8") as file:
        raw = json.load(file)
    rows = []
    for obj in raw.values():
        object_id = obj.get("objectID")
        if object_id is None:
            continue
        rows.append({"objectID": int(object_id), "primaryImage": (obj.get("primaryImage") or "").strip()})
    rows.sort(key=lambda item: item["objectID"])
    if max_objects is not None:
        rows = rows[:max_objects]
    return rows


def _load_bw_cache(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    cache: dict[str, dict] = {}
    with path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            url = (row.get("image_url") or "").strip()
            if not url:
                continue
            cache[url] = row
    return cache


def _save_bw_cache(path: Path, cache: dict[str, dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "image_url",
        "is_grayscale",
        "grayscale_ratio",
        "sampled_pixels",
        "error",
        "checked_at",
    ]
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for key in sorted(cache.keys()):
            writer.writerow(cache[key])


def _check_bw_with_cache(image_url: str, cache: dict[str, dict], refresh: bool) -> tuple[bool | None, float | None, str]:
    if (not refresh) and image_url in cache:
        cached = cache[image_url]
        error = (cached.get("error") or "").strip()
        if error:
            return None, None, error
        return cached.get("is_grayscale") == "true", float(cached.get("grayscale_ratio") or 0.0), ""

    checked_at = datetime.now(timezone.utc).isoformat()
    try:
        result = check_image_url_grayscale(image_url=image_url)
        cache[image_url] = {
            "image_url": image_url,
            "is_grayscale": "true" if result.is_grayscale else "false",
            "grayscale_ratio": f"{result.grayscale_ratio:.8f}",
            "sampled_pixels": str(result.sampled_pixels),
            "error": "",
            "checked_at": checked_at,
        }
        return result.is_grayscale, result.grayscale_ratio, ""
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


def _no_bg_path(object_id: int) -> Path:
    return REAL_IMAGES_DIR / f"{object_id}_no_bg.png"


def run_pipeline(
    max_objects: int | None = None,
    dominant_count: int = 8,
    max_groups: int = 10,
    refresh_bw_cache: bool = False,
) -> dict:
    objects = _load_objects(path=OBJECTS_JSON_PATH, max_objects=max_objects)
    bw_cache = _load_bw_cache(path=BW_CACHE_PATH)

    rows: list[dict] = []
    for obj in objects:
        object_id = obj["objectID"]
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
            "color_group_id": "",
            "color_group_label": "",
            "color_group_key": "",
            "no_bg_image_path": str(_no_bg_path(object_id)),
            "no_bg_image_exists": False,
            "dominant_color_foreground_pixels": "",
        }

        if not image_url:
            row["color_analysis_status"] = "missing_primary_image"
            rows.append(row)
            continue

        is_grayscale, grayscale_ratio, bw_error = _check_bw_with_cache(
            image_url=image_url,
            cache=bw_cache,
            refresh=refresh_bw_cache,
        )

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
            result = extract_dominant_colors(image_path=image_path, n_colors=dominant_count)
            row["top_color_hex"] = result.colors_hex[0]
            row["dominant_colors_hex"] = json.dumps(result.colors_hex)
            row["dominant_colors_share"] = json.dumps([round(value, 8) for value in result.shares])
            row["dominant_color_foreground_pixels"] = result.foreground_pixels
            row["color_analysis_status"] = "eligible"

        except Exception as error:  # noqa: BLE001
            row["color_analysis_status"] = f"palette_error:{error}"

        rows.append(row)

    _save_bw_cache(path=BW_CACHE_PATH, cache=bw_cache)

    output_df = pd.DataFrame(rows)
    output_df = output_df.sort_values("objectID").reset_index(drop=True)
    COLOR_GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    output_df.to_csv(OUTPUT_CSV_PATH, index=False)

    cluster_stats = run_reclustering(max_groups=max_groups)

    stats = {
        "objects_seen": int(len(objects)),
        "rows_written": int(len(output_df)),
        "eligible_total": int((output_df["color_eligible"] == True).sum()),  # noqa: E712
        "eligible_with_palette": int((output_df["color_analysis_status"] == "eligible").sum()),
        "bw_original_count": int((output_df["color_analysis_status"] == "bw_original").sum()),
        "missing_primary_image_count": int((output_df["color_analysis_status"] == "missing_primary_image").sum()),
        "missing_no_bg_count": int((output_df["color_analysis_status"] == "missing_no_bg").sum()),
        "url_fetch_error_count": int((output_df["color_analysis_status"] == "url_fetch_error").sum()),
        "cluster_count": int(cluster_stats["group_count_including_multicolor"]),
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "output_csv_path": str(OUTPUT_CSV_PATH),
        "cluster_summary_path": str(CLUSTER_SUMMARY_PATH),
        "bw_cache_path": str(BW_CACHE_PATH),
        "cluster_group_labels_path": str(cluster_stats["group_labels_path"]),
    }
    RUN_STATS_PATH.write_text(json.dumps(stats, indent=2), encoding="utf-8")
    return stats


def main() -> None:
    args = parse_args()
    stats = run_pipeline(
        max_objects=args.max_objects,
        dominant_count=args.dominant_count,
        max_groups=args.max_groups,
        refresh_bw_cache=args.refresh_bw_cache,
    )
    print(f"Saved color fields to {stats['output_csv_path']}")
    print(f"Saved cluster summary to {stats['cluster_summary_path']}")
    print(f"Saved run stats to {RUN_STATS_PATH}")
    print(f"rows_written={stats['rows_written']} clusters={stats['cluster_count']}")


if __name__ == "__main__":
    main()
