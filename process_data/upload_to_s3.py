import argparse
import json
import subprocess
from pathlib import Path

# Run from repo root:
#   python process_data/upload_to_s3.py
# Optional safety check (no uploads):
#   python process_data/upload_to_s3.py --dry-run

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_DIR = REPO_ROOT / "process_data/generated/real_images"
DEFAULT_BUCKET = "vessels-thesis"
DEFAULT_PREFIX = "real_images"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Upload real_images to S3 and skip duplicate filenames."
    )
    parser.add_argument(
        "--source-dir",
        default=str(DEFAULT_SOURCE_DIR),
        help=f"Local directory to upload (default: {DEFAULT_SOURCE_DIR}).",
    )
    parser.add_argument(
        "--bucket",
        default=DEFAULT_BUCKET,
        help=f"S3 bucket name (default: {DEFAULT_BUCKET}).",
    )
    parser.add_argument(
        "--prefix",
        default=DEFAULT_PREFIX,
        help=f"S3 key prefix (default: {DEFAULT_PREFIX}).",
    )
    parser.add_argument(
        "--profile",
        default="",
        help="Optional AWS profile name to use.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned uploads/skips without uploading.",
    )
    return parser.parse_args()


def iter_files(source_dir: Path):
    for path in sorted(source_dir.iterdir()):
        if path.is_file():
            yield path


def run_aws_json(args):
    completed = subprocess.run(
        args,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(completed.stdout) if completed.stdout.strip() else {}


def list_existing_filenames(bucket: str, prefix: str, profile: str):
    existing = set()
    continuation_token = None
    key_prefix = f"{prefix.rstrip('/')}/"

    while True:
        cmd = [
            "aws",
            "s3api",
            "list-objects-v2",
            "--bucket",
            bucket,
            "--prefix",
            key_prefix,
            "--output",
            "json",
        ]
        if profile:
            cmd.extend(["--profile", profile])
        if continuation_token:
            cmd.extend(["--continuation-token", continuation_token])

        page = run_aws_json(cmd)
        for obj in page.get("Contents", []):
            key = obj.get("Key", "")
            name = Path(key).name
            if name:
                existing.add(name)

        if not page.get("IsTruncated"):
            break
        continuation_token = page.get("NextContinuationToken")

    return existing


def upload_files(source_dir: Path, bucket: str, prefix: str, profile: str, dry_run: bool):
    existing_names = list_existing_filenames(bucket, prefix, profile)
    uploaded = 0
    skipped_duplicate = 0
    failed = 0

    files = list(iter_files(source_dir))
    print(f"source_dir={source_dir}")
    print(f"bucket={bucket}")
    print(f"prefix={prefix}")
    print(f"local_files={len(files)}")
    print(f"existing_filenames_in_s3={len(existing_names)}")

    for idx, file_path in enumerate(files, start=1):
        filename = file_path.name
        if filename in existing_names:
            skipped_duplicate += 1
            continue

        key = f"{prefix.rstrip('/')}/{filename}"
        if dry_run:
            print(f"[dry-run] upload s3://{bucket}/{key}")
            uploaded += 1
            existing_names.add(filename)
            continue

        try:
            cmd = ["aws", "s3", "cp", str(file_path), f"s3://{bucket}/{key}"]
            if profile:
                cmd.extend(["--profile", profile])
            subprocess.run(cmd, check=True, capture_output=True, text=True)
            uploaded += 1
            existing_names.add(filename)
        except subprocess.CalledProcessError as error:
            failed += 1
            stderr = error.stderr.strip() if error.stderr else str(error)
            print(f"error uploading {filename}: {stderr}")

        if idx % 200 == 0:
            print(
                f"progress={idx}/{len(files)} uploaded={uploaded} "
                f"skipped_duplicate={skipped_duplicate} failed={failed}"
            )

    print(
        f"done uploaded={uploaded} skipped_duplicate={skipped_duplicate} "
        f"failed={failed} total_local={len(files)}"
    )


def main():
    args = parse_args()
    source_dir = Path(args.source_dir)
    if not source_dir.exists() or not source_dir.is_dir():
        raise FileNotFoundError(f"source directory not found: {source_dir}")

    upload_files(
        source_dir=source_dir,
        bucket=args.bucket,
        prefix=args.prefix,
        profile=args.profile,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
