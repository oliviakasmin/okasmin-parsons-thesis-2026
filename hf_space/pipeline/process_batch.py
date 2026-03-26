#!/usr/bin/env python3
# RUN THIS FILE FROM ROOT DIRECTORY
# python hf_space/pipeline/process_batch.py
#
# QUICK START
# 1) Default test mode (processes 1 image from objects.json):
#    python hf_space/pipeline/process_batch.py
# 2) Single objectID from objects.json:
#    python hf_space/pipeline/process_batch.py --object-id 46043
# 3) Batch N images:
#    python hf_space/pipeline/process_batch.py --limit 25
# 4) Full run:
#    python hf_space/pipeline/process_batch.py --all

import argparse
import json
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from crop_standardize import (
    DEFAULT_ALPHA_THRESHOLD,
    DEFAULT_MARGIN_RATIO,
    DEFAULT_TARGET_SIZE,
)
from extract_features import (
    DEFAULT_NUM_SAMPLES,
    extract_features_for_mask,
    write_feature_csv,
)

DEFAULT_LIMIT = 1
DEFAULT_OBJECTS_JSON = "pipeline/data/objects.json"
DEFAULT_MANUAL_REJECT_JSON = "pipeline/data/manual_reject_object_ids.json"
DEFAULT_OUTPUT_DIR = "hf_space/pipeline/test_images"
DEFAULT_DRY_RUN = True
TEST_FEATURES_CSV = "hf_space/pipeline/features/test_silhouette_features.csv"
REAL_FEATURES_CSV = "hf_space/pipeline/features/silhouette_features.csv"
DEFAULT_SKIP_EXISTING = True
DEFAULT_PREFETCH_COUNT = 4
DEFAULT_DOWNLOAD_WORKERS = 4


def load_objects_json(objects_json_path):
    # Accept list-style JSON, {"objects": [...]}, or {"44793": {...}, ...}.
    with objects_json_path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get("objects"), list):
        return data["objects"]
    if isinstance(data, dict):
        values = list(data.values())
        if values and all(isinstance(item, dict) for item in values):
            return values
    raise ValueError(
        "Expected objects JSON as a list, a dict with an 'objects' list, "
        "or a dict keyed by object IDs."
    )


def load_manual_reject_ids(manual_reject_json_path):
    if not manual_reject_json_path.exists():
        return set()

    with manual_reject_json_path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, list):
        raise ValueError(f"Expected manual reject JSON to be a list: {manual_reject_json_path}")
    return {str(item).strip() for item in data if str(item).strip()}


def build_jobs_from_json(objects, limit, process_all):
    # Build a list of processing jobs from objects JSON records.
    jobs = []
    for obj in objects:
        object_id = obj.get("objectID")
        image_url = obj.get("primaryImageSmall")
        if not object_id or not image_url:
            continue
        jobs.append({"object_id": str(object_id), "image_url": image_url})
        if not process_all and len(jobs) >= limit:
            break
    return jobs


def find_object_job(object_id, objects):
    # Lookup helper for --object-id mode.
    for obj in objects:
        if str(obj.get("objectID")) != str(object_id):
            continue
        image_url = obj.get("primaryImageSmall")
        if image_url:
            return {"object_id": str(object_id), "image_url": image_url}
    return None


def resolve_jobs(args, objects):
    # Resolve CLI inputs into a unified [{object_id, image_url}, ...] job list.
    # Mode 1: single object id looked up in JSON.
    if args.object_id:
        job = find_object_job(args.object_id, objects)
        if job is None:
            raise ValueError(f"objectID {args.object_id} not found or has no image URL.")
        return [job]

    # Mode 2: batch from JSON (defaults to first valid image only).
    return build_jobs_from_json(
        objects=objects,
        limit=args.limit,
        process_all=args.all,
    )


def process_job(
    job,
    output_dir,
    target_size,
    alpha_threshold,
    margin_ratio,
    run_remove_background_step,
    run_crop_standardize_step,
    source_image,
):
    object_id = job["object_id"]

    # Step 1) Remove background in memory.
    no_bg_image, model_mask = run_remove_background_step(image=source_image)
    # Step 2) Crop + standardize in memory.
    standardized_image, standardized_mask, meta = run_crop_standardize_step(
        no_bg_image=no_bg_image,
        model_mask=model_mask,
        object_id=object_id,
        target_size=target_size,
        alpha_threshold=alpha_threshold,
        margin_ratio=margin_ratio,
    )

    # Step 3) Save final standardized outputs for frontend use.
    standardized_path = output_dir / f"{object_id}_no_bg_standardized.png"
    standardized_mask_path = output_dir / f"{object_id}_mask_standardized.png"
    standardized_image.save(standardized_path)
    standardized_mask.save(standardized_mask_path)

    print(
        f"Saved {standardized_path.name} and {standardized_mask_path.name} "
        f"(left={meta['left_clearance_px']} right={meta['right_clearance_px']})"
    )
    return standardized_mask_path


def prefetch_jobs_with_images(jobs, download_image_from_url, prefetch_count, download_workers):
    if prefetch_count <= 0:
        prefetch_count = 1
    if download_workers <= 0:
        download_workers = 1

    iterator = iter(jobs)
    queue = deque()

    with ThreadPoolExecutor(max_workers=download_workers) as executor:
        for _ in range(prefetch_count):
            try:
                job = next(iterator)
            except StopIteration:
                break
            queue.append((job, executor.submit(download_image_from_url, job["image_url"])))

        while queue:
            job, future = queue.popleft()
            try:
                source_image = future.result()
                yield job, source_image, None
            except Exception as error:
                yield job, None, error
            try:
                next_job = next(iterator)
            except StopIteration:
                continue
            queue.append(
                (next_job, executor.submit(download_image_from_url, next_job["image_url"]))
            )


def parse_args():
    # CLI allows single-image test runs and scalable batch runs.
    parser = argparse.ArgumentParser(
        description="Batch runner for remove_background -> crop_standardize pipeline."
    )
    parser.add_argument("--object-id", help="Single objectID to process.")
    parser.add_argument(
        "--objects-json",
        default=DEFAULT_OBJECTS_JSON,
        help=f"Path to objects JSON (default: {DEFAULT_OBJECTS_JSON}).",
    )
    parser.add_argument(
        "--manual-reject-json",
        default=DEFAULT_MANUAL_REJECT_JSON,
        help=(
            "Path to manual reject object IDs JSON. IDs in this file are skipped "
            f"(default: {DEFAULT_MANUAL_REJECT_JSON})."
        ),
    )
    parser.add_argument(
        "--output-dir",
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output directory for standardized images (default: {DEFAULT_OUTPUT_DIR}).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=DEFAULT_LIMIT,
        help=f"How many images to process from JSON when not using single mode (default: {DEFAULT_LIMIT}).",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Process all valid entries from objects JSON.",
    )
    parser.add_argument(
        "--target-size",
        type=int,
        default=DEFAULT_TARGET_SIZE,
        help=f"Standardized output size (default: {DEFAULT_TARGET_SIZE}).",
    )
    parser.add_argument(
        "--alpha-threshold",
        type=int,
        default=DEFAULT_ALPHA_THRESHOLD,
        help=f"Alpha threshold for mask operations (default: {DEFAULT_ALPHA_THRESHOLD}).",
    )
    parser.add_argument(
        "--margin-ratio",
        type=float,
        default=DEFAULT_MARGIN_RATIO,
        help=f"Margin ratio around standardized vessel (default: {DEFAULT_MARGIN_RATIO}).",
    )
    parser.add_argument(
        "--dry-run",
        action=argparse.BooleanOptionalAction,
        default=DEFAULT_DRY_RUN,
        help=(
            "When true, writes extracted features to test_silhouette_features.csv. "
            "Use --no-dry-run to write to silhouette_features.csv."
        ),
    )
    parser.add_argument(
        "--skip-existing",
        action=argparse.BooleanOptionalAction,
        default=DEFAULT_SKIP_EXISTING,
        help=(
            "Skip processing when both standardized output files already exist. "
            "When skipped, features are still extracted from the existing mask."
        ),
    )
    parser.add_argument(
        "--prefetch-count",
        type=int,
        default=DEFAULT_PREFETCH_COUNT,
        help=f"How many downloads to keep prefetched (default: {DEFAULT_PREFETCH_COUNT}).",
    )
    parser.add_argument(
        "--download-workers",
        type=int,
        default=DEFAULT_DOWNLOAD_WORKERS,
        help=f"Number of image download workers (default: {DEFAULT_DOWNLOAD_WORKERS}).",
    )
    return parser.parse_args()


def main():
    # 1) Parse config.
    args = parse_args()
    # 2) Resolve filesystem paths.
    repo_root = Path(__file__).resolve().parents[2]
    output_dir = repo_root / args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    features_output_path = repo_root / (TEST_FEATURES_CSV if args.dry_run else REAL_FEATURES_CSV)

    # 3) Load source metadata and convert to processing jobs.
    objects_json_path = repo_root / args.objects_json
    objects = load_objects_json(objects_json_path)
    jobs = resolve_jobs(args, objects)
    manual_reject_ids = load_manual_reject_ids(repo_root / args.manual_reject_json)
    if manual_reject_ids:
        original_job_count = len(jobs)
        jobs = [job for job in jobs if job["object_id"] not in manual_reject_ids]
        skipped_reject_count = original_job_count - len(jobs)
        if skipped_reject_count > 0:
            print(
                f"Skipping {skipped_reject_count} object(s) from manual reject list "
                f"({args.manual_reject_json})."
            )

    if not jobs:
        print("No valid jobs to process.")
        return

    # Import once so we avoid repeated per-image import overhead.
    from crop_standardize import run_crop_standardize_step
    from remove_background import download_image_from_url, run_remove_background_step

    # 4) Run pipeline per job and track success/failure.
    print(f"Starting pipeline for {len(jobs)} image(s)...")
    succeeded = 0
    failed = 0
    skipped_existing = 0
    feature_rows = []
    feature_errors = 0
    jobs_to_process = []
    failed_object_ids = []

    for job in jobs:
        object_id = job["object_id"]
        standardized_path = output_dir / f"{object_id}_no_bg_standardized.png"
        standardized_mask_path = output_dir / f"{object_id}_mask_standardized.png"
        if args.skip_existing and standardized_path.exists() and standardized_mask_path.exists():
            skipped_existing += 1
            print(f"Skipping {object_id}: standardized outputs already exist.")
            try:
                feature_rows.append(extract_features_for_mask(mask_path=standardized_mask_path))
            except Exception as error:
                feature_errors += 1
                print(f"Feature extraction failed for {object_id}: {error}")
            continue
        jobs_to_process.append(job)

    for job, source_image, download_error in prefetch_jobs_with_images(
        jobs=jobs_to_process,
        download_image_from_url=download_image_from_url,
        prefetch_count=args.prefetch_count,
        download_workers=args.download_workers,
    ):
        if download_error is not None:
            failed += 1
            failed_object_id = job["object_id"]
            failed_object_ids.append(failed_object_id)
            print(f"Failed {failed_object_id}: download error: {download_error}")
            continue
        try:
            mask_path = process_job(
                job=job,
                output_dir=output_dir,
                target_size=args.target_size,
                alpha_threshold=args.alpha_threshold,
                margin_ratio=args.margin_ratio,
                run_remove_background_step=run_remove_background_step,
                run_crop_standardize_step=run_crop_standardize_step,
                source_image=source_image,
            )
            succeeded += 1
            try:
                feature_rows.append(extract_features_for_mask(mask_path=mask_path))
            except Exception as error:
                feature_errors += 1
                print(f"Feature extraction failed for {job['object_id']}: {error}")
        except Exception as error:
            failed += 1
            failed_object_id = job["object_id"]
            failed_object_ids.append(failed_object_id)
            print(f"Failed {failed_object_id}: {error}")

    write_feature_csv(
        rows=feature_rows,
        output_path=features_output_path,
        n_samples=DEFAULT_NUM_SAMPLES,
    )
    print(
        f"Features saved to {features_output_path} "
        f"(rows={len(feature_rows)}, feature_errors={feature_errors}, dry_run={args.dry_run})"
    )
    print(f"Done. Succeeded: {succeeded}, Failed: {failed}, Skipped existing: {skipped_existing}")
    if failed_object_ids:
        print(f"Failed object IDs: {failed_object_ids}")


if __name__ == "__main__":
    main()
