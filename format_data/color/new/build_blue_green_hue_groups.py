"""Build hue-first groups for the combined blue/green manual color families.

This is intentionally not KMeans. It ignores most tone/value information and assigns each
object to hue-first groups. Use ``--scheme blue_green`` for two groups or
``--scheme blue_turquoise_celadon_green`` for four groups.

Run from repo root:

python -m format_data.color.new.build_blue_green_hue_groups
python -m format_data.color.new.build_blue_green_hue_groups --groups cyan blue celadon green blue_green_family
"""

from __future__ import annotations

import argparse
import colorsys
import json
import math
from pathlib import Path
from typing import Any

import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_INPUT = ROOT / "format_data" / "generated" / "color" / "object_color_fields_new.csv"
DEFAULT_MANUAL_JSON = ROOT / "format_data" / "color" / "new" / "manual_color_groups.json"
DEFAULT_GROUP_JSON_OUTPUT = ROOT / "format_data" / "color" / "new" / "new_color_groups.json"
DEFAULT_DIAGNOSTIC_OUTPUT = ROOT / "format_data" / "generated" / "color" / "blue_green_hue_groups.csv"
DEFAULT_GROUPS = ("cyan", "blue", "celadon", "green", "blue_green_family")

HUE_ANCHORS = {
    "green": 130.0,
    "celadon": 155.0,
    "turquoise": 180.0,
    "blue": 220.0,
}
GROUP_OUTPUT_ORDER_BY_SCHEME = {
    "blue_green": ("blue", "green"),
    "blue_turquoise_celadon_green": ("blue", "turquoise", "celadon", "green"),
}
SOURCE_GROUP_FALLBACK = {
    "blue": "blue",
    "cyan": "blue",
    "blue_green_family": "green",
    "celadon": "green",
    "green": "green",
}
SOURCE_GROUP_FALLBACK_FOUR_WAY = {
    "blue": "blue",
    "cyan": "turquoise",
    "blue_green_family": "turquoise",
    "celadon": "celadon",
    "green": "green",
}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Hue-first split of blue/green objects.")
    p.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="CSV with colorgram columns.")
    p.add_argument("--manual-json", type=Path, default=DEFAULT_MANUAL_JSON)
    p.add_argument("--groups", nargs="*", default=list(DEFAULT_GROUPS), help="Manual groups to combine.")
    p.add_argument("--ids", nargs="*", default=[], help="Optional explicit object IDs to include.")
    p.add_argument("--group-prefix", default="hue", help="Prefix for output JSON groups.")
    p.add_argument(
        "--scheme",
        choices=tuple(GROUP_OUTPUT_ORDER_BY_SCHEME.keys()),
        default="blue_green",
        help="Which named hue groups to output.",
    )
    p.add_argument("--json-output", type=Path, default=DEFAULT_GROUP_JSON_OUTPUT)
    p.add_argument("--diagnostic-output", type=Path, default=DEFAULT_DIAGNOSTIC_OUTPUT)
    p.add_argument(
        "--min-saturation",
        type=float,
        default=0.08,
        help="Ignore very neutral swatches below this HSV saturation.",
    )
    p.add_argument(
        "--min-value",
        type=float,
        default=0.15,
        help="Ignore nearly black swatches below this HSV value.",
    )
    p.add_argument(
        "--hue-min",
        type=float,
        default=70.0,
        help="Lower HSV hue bound for blue/green evidence.",
    )
    p.add_argument(
        "--hue-max",
        type=float,
        default=260.0,
        help="Upper HSV hue bound for blue/green evidence.",
    )
    p.add_argument(
        "--celadon-saturation-max",
        type=float,
        default=0.24,
        help="Mean saturation at or below this becomes celadon/muted when hue is in range.",
    )
    p.add_argument(
        "--celadon-hue-min",
        type=float,
        default=90.0,
        help="Lower mean hue bound for celadon/muted classification.",
    )
    p.add_argument(
        "--celadon-hue-max",
        type=float,
        default=190.0,
        help="Upper mean hue bound for celadon/muted classification.",
    )
    return p.parse_args()


def coerce_object_id(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return int(value)
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    return None


def parse_json_list(raw: Any) -> list[Any]:
    if raw is None or (isinstance(raw, float) and math.isnan(raw)):
        return []
    s = str(raw).strip()
    if not s:
        return []
    try:
        value = json.loads(s)
    except json.JSONDecodeError:
        return []
    return value if isinstance(value, list) else []


def load_manual_groups(path: Path) -> dict[str, list[int]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        return {}
    out: dict[str, list[int]] = {}
    for name, values in raw.items():
        if not isinstance(values, list):
            continue
        out[name] = [oid for value in values if (oid := coerce_object_id(value)) is not None]
    return out


def selected_ids_from_args(args: argparse.Namespace) -> tuple[list[int], dict[int, list[str]]]:
    manual_groups = load_manual_groups(args.manual_json)
    selected: list[int] = []
    sources_by_id: dict[int, list[str]] = {}

    for group_name in args.groups:
        if group_name not in manual_groups:
            known = ", ".join(sorted(manual_groups.keys())[:12])
            raise SystemExit(f"Unknown manual group: {group_name!r}. Known examples: {known}")
        for object_id in manual_groups[group_name]:
            selected.append(object_id)
            sources_by_id.setdefault(object_id, []).append(group_name)

    for raw_id in args.ids:
        object_id = coerce_object_id(raw_id)
        if object_id is None:
            raise SystemExit(f"Invalid object ID: {raw_id!r}")
        selected.append(object_id)
        sources_by_id.setdefault(object_id, []).append("explicit_ids")

    return sorted(set(selected)), sources_by_id


def angular_distance_degrees(a: float, b: float) -> float:
    return abs((a - b + 180.0) % 360.0 - 180.0)


def classify_hue(
    mean_hue: float,
    mean_saturation: float,
    source_groups: list[str],
    args: argparse.Namespace,
) -> str:
    if args.scheme == "blue_green":
        blue_dist = angular_distance_degrees(mean_hue, HUE_ANCHORS["blue"])
        green_dist = angular_distance_degrees(mean_hue, HUE_ANCHORS["green"])
        return "blue" if blue_dist <= green_dist else "green"

    if "celadon" in source_groups:
        return "celadon"
    if (
        args.celadon_hue_min <= mean_hue <= args.celadon_hue_max
        and mean_saturation <= args.celadon_saturation_max
    ):
        return "celadon"
    hue_groups = ("green", "turquoise", "blue")
    return min(hue_groups, key=lambda name: angular_distance_degrees(mean_hue, HUE_ANCHORS[name]))


def classify_from_source_groups(source_groups: list[str], scheme: str) -> str | None:
    fallback = (
        SOURCE_GROUP_FALLBACK_FOUR_WAY
        if scheme == "blue_turquoise_celadon_green"
        else SOURCE_GROUP_FALLBACK
    )
    for source_group in source_groups:
        if source_group in fallback:
            return fallback[source_group]
    return None


def object_hue_summary(row: dict[str, Any], args: argparse.Namespace) -> tuple[float | None, float, int, float]:
    rgbs = parse_json_list(row.get("colorgram_palette_rgb"))
    shares = parse_json_list(row.get("colorgram_palette_share"))
    if not rgbs or not shares:
        return None, 0.0, 0, 0.0

    weighted_hue = 0.0
    total_weight = 0.0
    total_share = 0.0
    saturation_by_share = 0.0
    swatches_used = 0

    for idx, rgb_raw in enumerate(rgbs):
        if idx >= len(shares):
            break
        if not isinstance(rgb_raw, list) or len(rgb_raw) != 3:
            continue
        try:
            r, g, b = [int(x) for x in rgb_raw]
            share = float(shares[idx])
        except (TypeError, ValueError):
            continue
        if share <= 0:
            continue

        h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
        hue = h * 360.0
        if s < args.min_saturation or v < args.min_value:
            continue
        if not (args.hue_min <= hue <= args.hue_max):
            continue

        # Weight by saturation so saturated hue beats pale/neutral tone.
        weight = share * s
        weighted_hue += hue * weight
        total_weight += weight
        total_share += share
        saturation_by_share += share * s
        swatches_used += 1

    if total_weight <= 0:
        return None, 0.0, 0, 0.0
    mean_saturation = saturation_by_share / total_share if total_share > 0 else 0.0
    return weighted_hue / total_weight, total_weight, swatches_used, mean_saturation


def main() -> None:
    args = parse_args()
    if not args.input.exists():
        raise SystemExit(f"Missing input CSV: {args.input}")
    if not args.manual_json.exists():
        raise SystemExit(f"Missing manual JSON: {args.manual_json}")

    selected_ids, sources_by_id = selected_ids_from_args(args)
    if not selected_ids:
        raise SystemExit("No object IDs selected. Pass --groups and/or --ids.")

    df = pd.read_csv(args.input)
    if "objectID" not in df.columns:
        raise SystemExit("Input CSV must include objectID.")

    selected_set = set(selected_ids)
    rows: list[dict[str, Any]] = []
    group_output_order = GROUP_OUTPUT_ORDER_BY_SCHEME[args.scheme]
    groups: dict[str, list[tuple[int, float]]] = {name: [] for name in group_output_order}
    fallback_count = 0
    skipped_no_hue = 0

    for _, row_series in df[df["objectID"].astype(int).isin(selected_set)].iterrows():
        row = row_series.to_dict()
        object_id = int(row["objectID"])
        mean_hue, hue_weight, swatches_used, mean_saturation = object_hue_summary(row, args)
        if mean_hue is None:
            source_groups = sources_by_id.get(object_id, [])
            group = classify_from_source_groups(source_groups, args.scheme)
            if group is None:
                skipped_no_hue += 1
                continue
            fallback_count += 1
            distance_to_anchor = 999.0
        else:
            source_groups = sources_by_id.get(object_id, [])
            group = classify_hue(mean_hue, mean_saturation, source_groups, args)
            distance_to_anchor = angular_distance_degrees(mean_hue, HUE_ANCHORS[group])

        groups[group].append((object_id, distance_to_anchor))
        rows.append(
            {
                "objectID": object_id,
                "hue_group": group,
                "mean_hue": "" if mean_hue is None else round(mean_hue, 4),
                "distance_to_anchor": round(distance_to_anchor, 4),
                "hue_weight": round(hue_weight, 6),
                "mean_saturation": round(mean_saturation, 6),
                "swatches_used": swatches_used,
                "used_source_fallback": mean_hue is None,
                "source_manual_groups": json.dumps(source_groups, separators=(",", ":")),
            },
        )

    output_groups: dict[str, list[int]] = {}
    prefix = args.group_prefix.strip().replace(" ", "_")
    for group_name in group_output_order:
        ordered = sorted(groups[group_name], key=lambda item: (item[1], item[0]))
        output_groups[f"{prefix}_{group_name}" if prefix else group_name] = [object_id for object_id, _ in ordered]

    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(json.dumps(output_groups, indent=2), encoding="utf-8")

    args.diagnostic_output.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).sort_values(["hue_group", "distance_to_anchor", "objectID"]).to_csv(
        args.diagnostic_output,
        index=False,
    )

    counts = ", ".join(f"{name}={len(groups[name])}" for name in group_output_order)
    print(
        f"Wrote hue groups to {args.json_output}\n"
        f"  diagnostics={args.diagnostic_output}\n"
        f"  selected={len(selected_ids)}, grouped={len(rows)}, source_fallback={fallback_count}, "
        f"skipped_no_hue={skipped_no_hue}\n"
        f"  {counts}",
        flush=True,
    )


if __name__ == "__main__":
    main()
