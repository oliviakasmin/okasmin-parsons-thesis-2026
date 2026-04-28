import csv
import json
from pathlib import Path

try:
    from .get_features import (
        DEFAULT_ALPHA_THRESHOLD,
        DEFAULT_NUM_SAMPLES,
        MASK_GLOB,
        extract_features_for_mask,
        extract_object_id,
        get_feature_fieldnames,
    )
except ImportError:
    from get_features import (
        DEFAULT_ALPHA_THRESHOLD,
        DEFAULT_NUM_SAMPLES,
        MASK_GLOB,
        extract_features_for_mask,
        extract_object_id,
        get_feature_fieldnames,
    )


def _load_mask_paths(input_dir):
    return sorted(Path(input_dir).glob(MASK_GLOB))


def _load_existing_object_ids(output_path):
    output_path = Path(output_path)
    if not output_path.exists() or output_path.stat().st_size == 0:
        return set()

    existing_ids = set()
    with output_path.open("r", newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        for row in reader:
            object_id = str(row.get("object_id", "")).strip()
            if object_id:
                existing_ids.add(object_id)
    return existing_ids


def _init_output_csv(output_path, fieldnames, overwrite=False):
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if overwrite or not output_path.exists() or output_path.stat().st_size == 0:
        with output_path.open("w", newline="", encoding="utf-8") as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
            writer.writeheader()


def _append_rows(output_path, fieldnames, rows):
    if not rows:
        return
    with Path(output_path).open("a", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writerows(rows)


def _append_skipped(skipped_log_path, skipped_records):
    if not skipped_records:
        return
    skipped_log_path = Path(skipped_log_path)
    skipped_log_path.parent.mkdir(parents=True, exist_ok=True)
    with skipped_log_path.open("a", encoding="utf-8") as file:
        for item in skipped_records:
            file.write(json.dumps(item) + "\n")


def run_feature_batches(
    input_dir=None,
    output_path=None,
    skipped_log_path=None,
    n_samples=DEFAULT_NUM_SAMPLES,
    alpha_threshold=DEFAULT_ALPHA_THRESHOLD,
    flush_every=100,
    start_index=0,
    max_files=None,
    overwrite=False,
):
    if flush_every <= 0:
        raise ValueError("flush_every must be > 0")

    features_dir = Path(__file__).resolve().parent
    process_data_dir = features_dir.parent
    resolved_input_dir = (
        Path(input_dir)
        if input_dir
        else (process_data_dir / "generated/real_images")
    )
    resolved_output_path = (
        Path(output_path)
        if output_path
        else (features_dir / "silhouette_features.csv")
    )
    resolved_skipped_log_path = (
        Path(skipped_log_path)
        if skipped_log_path
        else (features_dir / "skipped_features.jsonl")
    )

    fieldnames = get_feature_fieldnames(n_samples=n_samples)
    _init_output_csv(resolved_output_path, fieldnames, overwrite=overwrite)

    if overwrite and resolved_skipped_log_path.exists():
        resolved_skipped_log_path.unlink()

    existing_ids = set() if overwrite else _load_existing_object_ids(resolved_output_path)

    mask_paths = _load_mask_paths(resolved_input_dir)
    start = max(0, start_index)
    end = len(mask_paths) if max_files is None else min(len(mask_paths), start + max_files)
    selected_paths = mask_paths[start:end]

    written = 0
    skipped = 0
    already_present = 0
    buffer_rows = []
    buffer_skipped = []

    for idx, mask_path in enumerate(selected_paths, start=1):
        object_id = extract_object_id(mask_path)
        if object_id in existing_ids:
            already_present += 1
            continue

        try:
            row = extract_features_for_mask(
                mask_path=mask_path,
                n_samples=n_samples,
                alpha_threshold=alpha_threshold,
            )
            buffer_rows.append(row)
            existing_ids.add(object_id)
            written += 1
        except Exception as error:
            skipped += 1
            buffer_skipped.append(
                {
                    "object_id": object_id,
                    "file": mask_path.name,
                    "error": str(error),
                }
            )

        if len(buffer_rows) >= flush_every or len(buffer_skipped) >= flush_every:
            _append_rows(resolved_output_path, fieldnames, buffer_rows)
            _append_skipped(resolved_skipped_log_path, buffer_skipped)
            buffer_rows = []
            buffer_skipped = []

        if idx % 100 == 0:
            print(
                f"progress={idx}/{len(selected_paths)} written={written} "
                f"skipped={skipped} already_present={already_present}"
            )

    _append_rows(resolved_output_path, fieldnames, buffer_rows)
    _append_skipped(resolved_skipped_log_path, buffer_skipped)

    return {
        "input_dir": str(resolved_input_dir),
        "output_path": str(resolved_output_path),
        "skipped_log_path": str(resolved_skipped_log_path),
        "total_masks_available": len(mask_paths),
        "selected_count": len(selected_paths),
        "written": written,
        "skipped": skipped,
        "already_present": already_present,
        "start_index": start,
        "end_index": end,
        "flush_every": flush_every,
    }


def main():
    summary = run_feature_batches()
    print("Feature batch processing complete.")
    for key, value in summary.items():
        print(f"- {key}: {value}")


if __name__ == "__main__":
    main()
