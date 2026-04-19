import argparse
import gc
import json
import sys
import time
from pathlib import Path

import torch

pipeline_dir = Path("../pipeline").resolve()
if str(pipeline_dir) not in sys.path:
    sys.path.insert(0, str(pipeline_dir))

from crop_standardize import standardize_single_image
from extract_mask_contours import (
    draw_contours_from_mask_image,
    extract_outline_from_mask_image,
)
from remove_background import run_remove_background_step
from utils import load_objects_json, save_images

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_DIR = REPO_ROOT / "hf_space/pipeline/real_images"
DEFAULT_ERROR_LOG = REPO_ROOT / "hf_space/pipeline/real_images_errors.jsonl"
DEFAULT_PROCESSED_IDS = REPO_ROOT / "hf_space/pipeline/real_images/processed_ids.txt"


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


def clear_memory():
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    if torch.backends.mps.is_available() and torch.backends.mps.is_built():
        torch.mps.empty_cache()


def process_single_object(object_id, image_url, output_dir):
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

    processed = 0
    skipped = 0
    errors = 0
    started_at = time.time()

    for idx, (object_id, image_url) in enumerate(selected, start=1):
        if object_id in processed_ids and has_all_outputs(object_id, output_dir):
            skipped += 1
            continue

        if args.skip_existing and has_all_outputs(object_id, output_dir):
            skipped += 1
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
                f"progress={idx}/{len(selected)} processed={processed} skipped={skipped} errors={errors} elapsed_s={elapsed:.1f}"
            )

    elapsed = time.time() - started_at
    print(f"done processed={processed} skipped={skipped} errors={errors} elapsed_s={elapsed:.1f}")
    print(f"error_log={error_log_path}")


if __name__ == "__main__":
    main()
