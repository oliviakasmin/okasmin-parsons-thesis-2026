import argparse
import csv
import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OBJECTS_JSON = REPO_ROOT / "fetch_data/data/objects.json"
DEFAULT_BUCKET = "vessels-thesis"
DEFAULT_PREFIX = "real_images"
EXPECTED_SUFFIXES = ("_no_bg.png", "_mask.png", "_outline.png")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Compare object IDs in objects.json against files present in an S3 image prefix."
    )
    parser.add_argument(
        "--objects-json",
        default=str(DEFAULT_OBJECTS_JSON),
        help=f"Path to objects.json (default: {DEFAULT_OBJECTS_JSON}).",
    )
    parser.add_argument(
        "--bucket",
        default=DEFAULT_BUCKET,
        help=f"S3 bucket name (default: {DEFAULT_BUCKET}).",
    )
    parser.add_argument(
        "--prefix",
        default=DEFAULT_PREFIX,
        help=f"S3 key prefix containing images (default: {DEFAULT_PREFIX}).",
    )
    parser.add_argument(
        "--profile",
        default="",
        help="Optional AWS CLI profile.",
    )
    parser.add_argument(
        "--out-json",
        default="",
        help="Optional path to write full JSON report.",
    )
    parser.add_argument(
        "--out-csv",
        default="",
        help="Optional path to write missing object IDs CSV.",
    )
    parser.add_argument(
        "--sample-limit",
        type=int,
        default=50,
        help="Max sample IDs to print in terminal output (default: 50).",
    )
    return parser.parse_args()


def load_expected_object_ids(objects_json_path: Path):
    with objects_json_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    object_ids = set()

    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, dict) and value.get("objectID") is not None:
                object_ids.add(str(value["objectID"]).strip())
            else:
                object_ids.add(str(key).strip())
    elif isinstance(data, list):
        for item in data:
            if not isinstance(item, dict):
                continue
            object_id = item.get("objectID")
            if object_id is None:
                continue
            object_ids.add(str(object_id).strip())
    else:
        raise ValueError("Unsupported objects.json format. Expected dict or list.")

    return {oid for oid in object_ids if oid}


def run_aws_json(command):
    completed = subprocess.run(
        command,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(completed.stdout) if completed.stdout.strip() else {}


def list_s3_keys(bucket: str, prefix: str, profile: str):
    keys = []
    continuation_token = None
    normalized_prefix = prefix.rstrip("/") + "/"

    while True:
        command = [
            "aws",
            "s3api",
            "list-objects-v2",
            "--bucket",
            bucket,
            "--prefix",
            normalized_prefix,
            "--output",
            "json",
        ]
        if profile:
            command.extend(["--profile", profile])
        if continuation_token:
            command.extend(["--continuation-token", continuation_token])

        page = run_aws_json(command)
        keys.extend(obj.get("Key", "") for obj in page.get("Contents", []))

        if not page.get("IsTruncated"):
            break
        continuation_token = page.get("NextContinuationToken")

    return [k for k in keys if k]


def parse_object_id_and_suffix(filename: str):
    for suffix in EXPECTED_SUFFIXES:
        if filename.endswith(suffix):
            return filename[: -len(suffix)], suffix
    return "", ""


def build_presence_by_object_id(keys):
    presence = {}
    for key in keys:
        filename = Path(key).name
        object_id, suffix = parse_object_id_and_suffix(filename)
        if not object_id or not suffix:
            continue
        if object_id not in presence:
            presence[object_id] = set()
        presence[object_id].add(suffix)
    return presence


def write_missing_ids_csv(path: Path, missing_ids):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["object_id"])
        for object_id in missing_ids:
            writer.writerow([object_id])


def main():
    args = parse_args()
    objects_json_path = Path(args.objects_json)
    if not objects_json_path.exists():
        raise FileNotFoundError(f"objects.json not found: {objects_json_path}")

    expected_ids = load_expected_object_ids(objects_json_path)
    keys = list_s3_keys(bucket=args.bucket, prefix=args.prefix, profile=args.profile)
    presence_by_id = build_presence_by_object_id(keys)

    present_ids = set(presence_by_id.keys())
    missing_ids = sorted(expected_ids - present_ids, key=lambda x: int(x) if x.isdigit() else x)
    extra_ids = sorted(present_ids - expected_ids, key=lambda x: int(x) if x.isdigit() else x)

    partial_by_id = {}
    for object_id in sorted(expected_ids & present_ids, key=lambda x: int(x) if x.isdigit() else x):
        seen = presence_by_id.get(object_id, set())
        if len(seen) < len(EXPECTED_SUFFIXES):
            partial_by_id[object_id] = sorted(set(EXPECTED_SUFFIXES) - seen)

    print(f"objects_json={objects_json_path}")
    print(f"bucket={args.bucket}")
    print(f"prefix={args.prefix}")
    print(f"expected_object_ids={len(expected_ids)}")
    print(f"s3_total_keys={len(keys)}")
    print(f"s3_object_ids_with_any_image={len(present_ids)}")
    print(f"missing_object_ids={len(missing_ids)}")
    print(f"partial_object_ids_missing_some_suffixes={len(partial_by_id)}")
    print(f"extra_object_ids_in_s3_not_in_objects_json={len(extra_ids)}")

    sample_limit = max(args.sample_limit, 0)
    if sample_limit > 0:
        print(f"sample_missing_object_ids={missing_ids[:sample_limit]}")
        print(f"sample_extra_object_ids={extra_ids[:sample_limit]}")

    if args.out_csv:
        out_csv_path = Path(args.out_csv)
        write_missing_ids_csv(out_csv_path, missing_ids)
        print(f"wrote_missing_ids_csv={out_csv_path}")

    if args.out_json:
        out_json_path = Path(args.out_json)
        out_json_path.parent.mkdir(parents=True, exist_ok=True)
        report = {
            "objects_json": str(objects_json_path),
            "bucket": args.bucket,
            "prefix": args.prefix,
            "expected_object_ids_count": len(expected_ids),
            "s3_total_keys_count": len(keys),
            "s3_object_ids_with_any_image_count": len(present_ids),
            "missing_object_ids_count": len(missing_ids),
            "partial_object_ids_count": len(partial_by_id),
            "extra_object_ids_count": len(extra_ids),
            "missing_object_ids": missing_ids,
            "partial_object_ids_missing_suffixes": partial_by_id,
            "extra_object_ids": extra_ids,
        }
        with out_json_path.open("w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        print(f"wrote_report_json={out_json_path}")


if __name__ == "__main__":
    main()
