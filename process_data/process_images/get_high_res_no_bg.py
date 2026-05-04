import argparse
import gc
import json
import sys
import time
import uuid
import warnings
from pathlib import Path

import torch

# Run from repo root in batches, same pattern as process_images.py:
# python process_data/process_images/get_high_res_no_bg.py --start-index 0 --limit 500 --skip-existing

warnings.filterwarnings(
    "ignore",
    category=FutureWarning,
    message=r"Importing from timm\.models\.layers is deprecated, please import via timm\.layers",
)
warnings.filterwarnings(
    "ignore",
    category=FutureWarning,
    message=r"Importing from timm\.models\.registry is deprecated, please import via timm\.models",
)

MODULE_DIR = Path(__file__).resolve().parent
if str(MODULE_DIR) not in sys.path:
    sys.path.insert(0, str(MODULE_DIR))

from utils import load_objects_json

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_DIR = REPO_ROOT / "process_data/generated/real_images_high_res_no_bg"
DEFAULT_ERROR_LOG = REPO_ROOT / "process_data/generated/real_images_high_res_no_bg_errors.jsonl"
DEFAULT_PROCESSED_IDS = REPO_ROOT / "process_data/generated/processed_ids_high_res_no_bg.txt"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Download primaryImage (high res), remove background, save as *_no_bg_high_res.png."
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help=f"Directory for *_no_bg_high_res.png (default: {DEFAULT_OUTPUT_DIR}).",
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
        help="Skip objects that already have *_no_bg_high_res.png.",
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
        image_url = (obj.get("primaryImage") or "").strip()
        if not object_id or not image_url:
            continue
        yield object_id, image_url


def has_output(object_id, output_dir):
    return (output_dir / f"{object_id}_no_bg_high_res.png").exists()


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


def save_no_bg_high_res(no_bg_image, object_id, output_dir):
    output_dir = Path(output_dir)
    final_path = output_dir / f"{object_id}_no_bg_high_res.png"
    token = uuid.uuid4().hex
    temp_path = output_dir / f"{final_path.name}.{token}.tmp"
    try:
        no_bg_image.save(temp_path, format="PNG")
        temp_path.replace(final_path)
        if not final_path.exists():
            raise RuntimeError(f"Failed to write {final_path}")
    except Exception:
        try:
            if temp_path.exists():
                temp_path.unlink()
        except Exception:
            pass
        raise
    return final_path


def process_single_object(object_id, image_url, output_dir):
    from remove_background import run_remove_background_step

    no_bg_image, _model_mask = run_remove_background_step(image_url=image_url)
    save_no_bg_high_res(no_bg_image, object_id, output_dir=output_dir)


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
    print(f"processed_ids_loaded={len(processed_ids)}")

    processed = 0
    skipped_existing = 0
    errors = 0
    started_at = time.time()

    for idx, (object_id, image_url) in enumerate(selected, start=1):
        if object_id in processed_ids and has_output(object_id, output_dir):
            skipped_existing += 1
            continue

        if args.skip_existing and has_output(object_id, output_dir):
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
                f"skipped_existing={skipped_existing} "
                f"errors={errors} elapsed_s={elapsed:.1f}"
            )

    elapsed = time.time() - started_at
    print(
        "done "
        f"processed={processed} "
        f"skipped_existing={skipped_existing} "
        f"errors={errors} elapsed_s={elapsed:.1f}"
    )
    print(f"error_log={error_log_path}")


if __name__ == "__main__":
    main()
