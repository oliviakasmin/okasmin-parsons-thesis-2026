import argparse
import gc
import json
import sys
import time
from pathlib import Path

import torch

MODULE_DIR = Path(__file__).resolve().parent
if str(MODULE_DIR) not in sys.path:
    sys.path.insert(0, str(MODULE_DIR))

from crop_standardize import standardize_single_image
from extract_mask_contours import (
    draw_contours_from_mask_image,
    extract_outline_from_mask_image,
)
from utils import load_objects_json, save_images

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_DIR = REPO_ROOT / "process_data/real_images"
DEFAULT_ERROR_LOG = REPO_ROOT / "process_data/real_images_errors.jsonl"
DEFAULT_PROCESSED_IDS = REPO_ROOT / "process_data/processed_ids.txt"
DEFAULT_SKIP_OBJECT_ID_FILES = [
    REPO_ROOT / "fetch_data/data/api_errors_object_ids.json",
    REPO_ROOT / "fetch_data/data/manual_reject_object_ids.json",
    REPO_ROOT / "fetch_data/data/reject_object_ids.json",
]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Process all objects from objects.json safely and incrementally."
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help=f"Directory for *_no_bg.png, *_mask.png, *_outline.png (default: {DEFAULT_OUTPUT_DIR}).",
    )
    parser.add_argument(
        "--start-index",
        type=int,
        default=0,
        help="Start index in objects list (default: 0).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Max number of items to process after start-index (0 = all).",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip objects that already have no_bg/mask/outline files.",
    )
    parser.add_argument(
        "--max-errors",
        type=int,
        default=100,
        help="Stop after this many errors to prevent runaway failures (default: 100).",
    )
    parser.add_argument(
        "--gc-every",
        type=int,
        default=25,
        help="Run GC and clear accelerator cache every N successful items (default: 25).",
    )
    parser.add_argument(
        "--error-log",
        default=str(DEFAULT_ERROR_LOG),
        help=f"JSONL path for per-item errors (default: {DEFAULT_ERROR_LOG}).",
    )
    parser.add_argument(
        "--processed-ids-file",
        default=str(DEFAULT_PROCESSED_IDS),
        help=f"Text file used to track successful object IDs (default: {DEFAULT_PROCESSED_IDS}).",
    )
    parser.add_argument(
        "--skip-object-ids-file",
        action="append",
        default=[str(path) for path in DEFAULT_SKIP_OBJECT_ID_FILES],
        help=("JSON file containing object IDs to always skip; repeat flag to add more files."),
    )
    return parser.parse_args()


def object_jobs(objects):
    for obj in objects:
        object_id = str(obj.get("objectID", "")).strip()
        image_url = obj.get("primaryImageSmall")
        if not object_id or not image_url:
            continue
        yield object_id, image_url


def has_all_outputs(object_id, output_dir):
    return all(
        [
            (output_dir / f"{object_id}_no_bg.png").exists(),
            (output_dir / f"{object_id}_mask.png").exists(),
            (output_dir / f"{object_id}_outline.png").exists(),
        ]
    )


def load_processed_ids(processed_ids_path):
    if not processed_ids_path.exists():
        return set()
    with processed_ids_path.open("r", encoding="utf-8") as file:
        return {line.strip() for line in file if line.strip()}


def append_processed_id(processed_ids_path, object_id):
    with processed_ids_path.open("a", encoding="utf-8") as file:
        file.write(f"{object_id}\n")


def load_skip_object_ids(skip_object_ids_paths):
    if not skip_object_ids_paths:
        return set()

    skip_ids = set()
    for raw_path in skip_object_ids_paths:
        path = Path(raw_path)
        if not path.exists():
            continue
        with path.open("r", encoding="utf-8") as file:
            data = json.load(file)
        if not isinstance(data, list):
            raise ValueError(f"Expected a JSON list of object IDs in {path}")
        skip_ids.update({str(item).strip() for item in data if str(item).strip()})
    return skip_ids


def clear_memory():
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    if torch.backends.mps.is_available() and torch.backends.mps.is_built():
        torch.mps.empty_cache()


def process_single_object(object_id, image_url, output_dir):
    # Import lazily so CLI help/arg parsing still works if model deps are missing.
    from remove_background import run_remove_background_step

    no_bg_image, model_mask = run_remove_background_step(image_url=image_url)
    standardized, std_mask = standardize_single_image(no_bg_image, model_mask)
    contours, _, _, _ = extract_outline_from_mask_image(std_mask)
    contours_image = draw_contours_from_mask_image(mask_image=std_mask, contours=contours)
    save_images(standardized, std_mask, contours_image, object_id, output_dir=output_dir)


def main():
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    error_log_path = Path(args.error_log)
    error_log_path.parent.mkdir(parents=True, exist_ok=True)
    processed_ids_path = Path(args.processed_ids_file)
    processed_ids_path.parent.mkdir(parents=True, exist_ok=True)
    processed_ids = load_processed_ids(processed_ids_path)
    skip_object_ids = load_skip_object_ids(args.skip_object_ids_file)

    objects = load_objects_json()
    jobs = list(object_jobs(objects))
    total = len(jobs)
    start = max(args.start_index, 0)
    end = total if args.limit <= 0 else min(total, start + args.limit)
    selected = jobs[start:end]

    print(f"total_objects={total}")
    print(f"selected_range=[{start}:{end}]")
    print(f"selected_count={len(selected)}")
    print(f"output_dir={output_dir}")
    print(f"processed_ids_file={processed_ids_path}")
    print(f"processed_ids_loaded={len(processed_ids)}")
    print(f"skip_object_ids_files={args.skip_object_ids_file}")
    print(f"skip_object_ids_loaded={len(skip_object_ids)}")

    processed = 0
    skipped_existing = 0
    skipped_blocklist = 0
    errors = 0
    started_at = time.time()

    for idx, (object_id, image_url) in enumerate(selected, start=1):
        if object_id in skip_object_ids:
            skipped_blocklist += 1
            continue

        if object_id in processed_ids and has_all_outputs(object_id, output_dir):
            skipped_existing += 1
            continue

        if args.skip_existing and has_all_outputs(object_id, output_dir):
            skipped_existing += 1
            continue

        try:
            process_single_object(object_id, image_url, output_dir)
            processed += 1
            if object_id not in processed_ids:
                append_processed_id(processed_ids_path, object_id)
                processed_ids.add(object_id)
            if args.gc_every > 0 and processed % args.gc_every == 0:
                clear_memory()
        except Exception as error:
            errors += 1
            record = {
                "object_id": object_id,
                "image_url": image_url,
                "error": str(error),
            }
            with error_log_path.open("a", encoding="utf-8") as file:
                file.write(json.dumps(record) + "\n")

            if errors >= args.max_errors:
                print(f"max_errors_reached={args.max_errors}")
                break

        if idx % 25 == 0:
            elapsed = time.time() - started_at
            print(
                "progress="
                f"{idx}/{len(selected)} processed={processed} "
                f"skipped_existing={skipped_existing} skipped_blocklist={skipped_blocklist} "
                f"errors={errors} elapsed_s={elapsed:.1f}"
            )

    elapsed = time.time() - started_at
    print(
        "done "
        f"processed={processed} "
        f"skipped_existing={skipped_existing} "
        f"skipped_blocklist={skipped_blocklist} "
        f"errors={errors} elapsed_s={elapsed:.1f}"
    )
    print(f"error_log={error_log_path}")


if __name__ == "__main__":
    main()
