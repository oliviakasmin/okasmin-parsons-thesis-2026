#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import random
import re
import time
import xml.etree.ElementTree as ET
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CLUSTERS_CSV = REPO_ROOT / "format_data/cluster_shape/final_clusters_object_ids.csv"
DEFAULT_INPUT_OUTLINE_DIR = REPO_ROOT / "process_data/generated/real_images"
DEFAULT_FAST_OUTPUT_DIR = REPO_ROOT / "process_data/generated/cluster_outline_svgs_fast"
DEFAULT_SAMPLED_OUTPUT_DIR = REPO_ROOT / "process_data/generated/cluster_outline_svgs_sampled"
DEFAULT_MANIFEST_JSON = REPO_ROOT / "process_data/generated/cluster_outline_svgs_manifest.json"
DEFAULT_GEOMETRY = ("768", "768", "0 0 768 768")

SVG_NS = "http://www.w3.org/2000/svg"


@dataclass(frozen=True)
class OutlineRecord:
    object_id: str
    path_d: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Build cluster-level stacked outline SVGs from per-object outline SVGs. "
            "Writes both fast single-path outputs and sampled editable outputs."
        )
    )
    parser.add_argument("--clusters-csv", type=Path, default=DEFAULT_CLUSTERS_CSV)
    parser.add_argument("--input-outline-dir", type=Path, default=DEFAULT_INPUT_OUTLINE_DIR)
    parser.add_argument("--fast-output-dir", type=Path, default=DEFAULT_FAST_OUTPUT_DIR)
    parser.add_argument("--sampled-output-dir", type=Path, default=DEFAULT_SAMPLED_OUTPUT_DIR)
    parser.add_argument("--sample-top-k", type=int, default=30)
    parser.add_argument("--sample-random-k", type=int, default=20)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--manifest-json", type=Path, default=DEFAULT_MANIFEST_JSON)
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip writing a cluster output file if it already exists.",
    )
    parser.add_argument(
        "--limit-clusters",
        type=int,
        default=0,
        help="For smoke testing, only process the first N clusters by sorted name (0 = all).",
    )
    return parser.parse_args()


def _safe_svg_id(text: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "-", text.strip())
    if not cleaned:
        cleaned = "unknown"
    if cleaned[0].isdigit():
        cleaned = f"id-{cleaned}"
    return cleaned


def _read_cluster_rows(clusters_csv: Path) -> dict[str, list[str]]:
    clusters: dict[str, list[str]] = defaultdict(list)
    with clusters_csv.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        required = {"object_id", "cluster"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSV missing required columns: {sorted(missing)}")
        for row in reader:
            object_id = str(row.get("object_id", "")).strip()
            cluster_name = str(row.get("cluster", "")).strip()
            if not object_id or not cluster_name:
                continue
            clusters[cluster_name].append(object_id)
    return dict(clusters)


def _svg_geometry_from_root(root: ET.Element) -> tuple[str, str, str]:
    width = root.attrib.get("width", "768")
    height = root.attrib.get("height", "768")
    view_box = root.attrib.get("viewBox", "0 0 768 768")
    return width, height, view_box


def _extract_outline_record(svg_path: Path, object_id: str) -> tuple[OutlineRecord, tuple[str, str, str]]:
    root = ET.fromstring(svg_path.read_text(encoding="utf-8"))
    width, height, view_box = _svg_geometry_from_root(root)

    path_element = root.find(f".//{{{SVG_NS}}}path")
    if path_element is None:
        path_element = root.find(".//path")
    if path_element is None:
        raise ValueError("No <path> found in SVG.")

    path_d = (path_element.attrib.get("d") or "").strip()
    if not path_d:
        raise ValueError("Path has empty d attribute.")

    return OutlineRecord(object_id=object_id, path_d=path_d), (width, height, view_box)


def _compose_svg(width: str, height: str, view_box: str, body_lines: list[str]) -> str:
    body = "\n".join(body_lines)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="{SVG_NS}" width="{width}" height="{height}" '
        f'viewBox="{view_box}" preserveAspectRatio="xMidYMid meet">\n'
        f"{body}\n"
        "</svg>\n"
    )


def _build_fast_svg(width: str, height: str, view_box: str, records: list[OutlineRecord]) -> str:
    combined_d = " ".join(record.path_d for record in records)
    lines = [
        '  <g fill="none" stroke="#ffffff" stroke-width="1" stroke-linejoin="round" stroke-linecap="round">',
        f'    <path id="cluster-stack-fast" d="{combined_d}" />',
        "  </g>",
    ]
    return _compose_svg(width=width, height=height, view_box=view_box, body_lines=lines)


def _sample_records(
    records: list[OutlineRecord],
    sample_top_k: int,
    sample_random_k: int,
    rng: random.Random,
) -> list[OutlineRecord]:
    if not records:
        return []

    top_k = max(0, sample_top_k)
    random_k = max(0, sample_random_k)

    selected: list[OutlineRecord] = records[:top_k]
    remaining = records[top_k:]

    if random_k > 0 and remaining:
        if random_k >= len(remaining):
            selected.extend(remaining)
        else:
            random_indices = sorted(rng.sample(range(len(remaining)), random_k))
            selected.extend(remaining[index] for index in random_indices)
    return selected


def _build_sampled_svg(
    width: str,
    height: str,
    view_box: str,
    cluster_name: str,
    records: list[OutlineRecord],
) -> str:
    cluster_id = _safe_svg_id(cluster_name)
    lines = [
        '  <g fill="none" stroke="#ffffff" stroke-width="1" stroke-linejoin="round" stroke-linecap="round">'
    ]
    for record in records:
        safe_object_id = _safe_svg_id(record.object_id)
        lines.append(
            f'    <path id="outline-obj-{safe_object_id}" data-object-id="{record.object_id}" '
            f'data-cluster-id="{cluster_name}" d="{record.path_d}" />'
        )
    lines.append("  </g>")
    lines.append(f'  <metadata id="cluster-meta-{cluster_id}">{{"cluster":"{cluster_name}"}}</metadata>')
    return _compose_svg(width=width, height=height, view_box=view_box, body_lines=lines)


def _write_text(path: Path, text: str, skip_existing: bool) -> bool:
    if skip_existing and path.exists():
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return True


def main() -> None:
    args = parse_args()
    t0 = time.time()
    rng = random.Random(args.seed)

    clusters_csv = args.clusters_csv
    input_outline_dir = args.input_outline_dir
    fast_output_dir = args.fast_output_dir
    sampled_output_dir = args.sampled_output_dir
    manifest_json = args.manifest_json

    if not clusters_csv.exists():
        raise FileNotFoundError(f"clusters CSV not found: {clusters_csv}")
    if not input_outline_dir.exists():
        raise FileNotFoundError(f"input outline dir not found: {input_outline_dir}")

    cluster_to_object_ids = _read_cluster_rows(clusters_csv)
    cluster_names = sorted(cluster_to_object_ids.keys())
    if args.limit_clusters > 0:
        cluster_names = cluster_names[: args.limit_clusters]

    print(f"clusters_csv={clusters_csv}")
    print(f"input_outline_dir={input_outline_dir}")
    print(f"cluster_count={len(cluster_names)}")

    geometry: tuple[str, str, str] | None = DEFAULT_GEOMETRY
    parsed_cache: dict[str, OutlineRecord] = {}
    missing_object_ids: set[str] = set()
    invalid_object_ids: dict[str, str] = {}
    clusters_manifest: list[dict[str, object]] = []

    wrote_fast = 0
    wrote_sampled = 0

    for cluster_name in cluster_names:
        object_ids = cluster_to_object_ids[cluster_name]
        records: list[OutlineRecord] = []
        cluster_missing: list[str] = []
        cluster_invalid: dict[str, str] = {}

        for object_id in object_ids:
            if object_id in missing_object_ids:
                cluster_missing.append(object_id)
                continue
            if object_id in invalid_object_ids:
                cluster_invalid[object_id] = invalid_object_ids[object_id]
                continue
            cached = parsed_cache.get(object_id)
            if cached is not None:
                records.append(cached)
                continue

            svg_path = input_outline_dir / f"{object_id}_outline.svg"
            if not svg_path.exists():
                missing_object_ids.add(object_id)
                cluster_missing.append(object_id)
                continue

            try:
                record, object_geometry = _extract_outline_record(svg_path=svg_path, object_id=object_id)
            except (OSError, ET.ParseError, ValueError) as error:
                error_msg = f"{type(error).__name__}: {error}"
                invalid_object_ids[object_id] = error_msg
                cluster_invalid[object_id] = error_msg
                continue

            if geometry is None:
                geometry = object_geometry
            parsed_cache[object_id] = record
            records.append(record)

        width, height, view_box = geometry

        fast_filename = f"{cluster_name}_stack_fast.svg"
        sampled_filename = f"{cluster_name}_stack_sampled.svg"
        fast_path = fast_output_dir / fast_filename
        sampled_path = sampled_output_dir / sampled_filename

        fast_written = False
        sampled_written = False
        sampled_records: list[OutlineRecord] = []

        if records:
            fast_svg = _build_fast_svg(width=width, height=height, view_box=view_box, records=records)
            fast_written = _write_text(path=fast_path, text=fast_svg, skip_existing=args.skip_existing)
            if fast_written:
                wrote_fast += 1

            sampled_records = _sample_records(
                records=records,
                sample_top_k=args.sample_top_k,
                sample_random_k=args.sample_random_k,
                rng=rng,
            )
            sampled_svg = _build_sampled_svg(
                width=width,
                height=height,
                view_box=view_box,
                cluster_name=cluster_name,
                records=sampled_records,
            )
            sampled_written = _write_text(
                path=sampled_path,
                text=sampled_svg,
                skip_existing=args.skip_existing,
            )
            if sampled_written:
                wrote_sampled += 1

        clusters_manifest.append(
            {
                "cluster": cluster_name,
                "object_count_csv": len(object_ids),
                "object_count_with_svg": len(records),
                "missing_svg_count": len(cluster_missing),
                "invalid_svg_count": len(cluster_invalid),
                "missing_object_ids": cluster_missing,
                "invalid_object_ids": cluster_invalid,
                "sampled_object_ids": [record.object_id for record in sampled_records],
                "fast_svg_filename": fast_filename,
                "sampled_svg_filename": sampled_filename,
                "fast_svg_written": fast_written,
                "sampled_svg_written": sampled_written,
            }
        )

    manifest = {
        "clusters_csv": str(clusters_csv),
        "input_outline_dir": str(input_outline_dir),
        "fast_output_dir": str(fast_output_dir),
        "sampled_output_dir": str(sampled_output_dir),
        "sample_top_k": args.sample_top_k,
        "sample_random_k": args.sample_random_k,
        "seed": args.seed,
        "skip_existing": bool(args.skip_existing),
        "limit_clusters": args.limit_clusters,
        "cluster_count": len(cluster_names),
        "unique_object_ids_parsed": len(parsed_cache),
        "missing_unique_object_ids": len(missing_object_ids),
        "invalid_unique_object_ids": len(invalid_object_ids),
        "wrote_fast_count": wrote_fast,
        "wrote_sampled_count": wrote_sampled,
        "elapsed_seconds": round(time.time() - t0, 3),
        "clusters": clusters_manifest,
    }
    manifest_json.parent.mkdir(parents=True, exist_ok=True)
    manifest_json.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"wrote_fast_count={wrote_fast}")
    print(f"wrote_sampled_count={wrote_sampled}")
    print(f"manifest_json={manifest_json}")


if __name__ == "__main__":
    main()
