from __future__ import annotations

import ast
import json
from pathlib import Path

import pandas as pd

ROOT = Path(".")
GROUPS_PATH = ROOT / "format_data/color/new/new_color_groups.json"
REPS_PATH = ROOT / "format_data/color/new/manual_representative_colors.json"
FIELDS_PATH = ROOT / "format_data/generated/color/object_color_fields_new.csv"


def parse_list(value):
    if pd.isna(value) or value == "":
        return []
    if isinstance(value, str):
        return ast.literal_eval(value)
    return value


def hue_distance(a: float, b: float) -> float:
    # Hues in the colorgram HSL field use 0-255 circular scale.
    diff = abs(a - b) % 256
    return min(diff, 256 - diff) / 128


def swatch_distance(a, b) -> float:
    ah, asat, al = a
    bh, bsat, bl = b
    hue_weight = max(asat, bsat) / 255
    sat_distance = abs(asat - bsat) / 255
    light_distance = abs(al - bl) / 255
    return (
        (hue_distance(ah, bh) * 3.0 * hue_weight)
        + (sat_distance * 0.75)
        + (light_distance * 0.45)
    )


def palette_distance(obj_palette, obj_shares, rep_palette, rep_shares) -> float:
    if not obj_palette or not rep_palette:
        return float("inf")
    total = 0.0
    total_weight = 0.0
    for swatch, share in zip(obj_palette, obj_shares):
        if share <= 0:
            continue
        best = min(swatch_distance(swatch, rep_swatch) for rep_swatch in rep_palette)
        total += best * share
        total_weight += share
    if total_weight == 0:
        return float("inf")
    # Add a small reciprocal term so palettes with the representative's key swatches rank higher.
    reciprocal = 0.0
    reciprocal_weight = 0.0
    for rep_swatch, rep_share in zip(rep_palette, rep_shares):
        if rep_share <= 0:
            continue
        reciprocal += min(swatch_distance(rep_swatch, swatch) for swatch in obj_palette) * rep_share
        reciprocal_weight += rep_share
    reciprocal_score = reciprocal / reciprocal_weight if reciprocal_weight else 0.0
    return (total / total_weight * 0.75) + (reciprocal_score * 0.25)


groups = json.loads(GROUPS_PATH.read_text(encoding="utf-8"))
representatives = json.loads(REPS_PATH.read_text(encoding="utf-8"))
all_needed_ids = {int(x) for ids in groups.values() if isinstance(ids, list) for x in ids}
all_needed_ids |= {int(x) for ids in representatives.values() if isinstance(ids, list) for x in ids}

fields = pd.read_csv(
    FIELDS_PATH,
    usecols=["objectID", "colorgram_palette_hsl", "colorgram_palette_share"],
)
fields = fields[fields["objectID"].isin(all_needed_ids)]
palettes = {}
for _, row in fields.iterrows():
    object_id = int(row["objectID"])
    palettes[object_id] = (
        parse_list(row["colorgram_palette_hsl"]),
        parse_list(row["colorgram_palette_share"]),
    )

changed_groups = []
missing_palette_ids = []
for group_name, ids in list(groups.items()):
    if not isinstance(ids, list):
        continue
    group_ids = [int(x) for x in ids]
    rep_ids = [int(x) for x in representatives.get(group_name, []) if int(x) in group_ids]
    if not rep_ids:
        continue

    rep_palettes = [palettes.get(rep_id) for rep_id in rep_ids if rep_id in palettes]
    if not rep_palettes:
        missing_palette_ids.extend(rep_ids)
        continue

    def sort_key(object_id: int):
        if object_id in rep_ids:
            return (0, rep_ids.index(object_id), object_id)
        obj_palette = palettes.get(object_id)
        if obj_palette is None:
            missing_palette_ids.append(object_id)
            return (2, float("inf"), object_id)
        score = min(
            palette_distance(obj_palette[0], obj_palette[1], rep_palette[0], rep_palette[1])
            for rep_palette in rep_palettes
        )
        return (1, score, object_id)

    sorted_ids = sorted(group_ids, key=sort_key)
    if sorted_ids != group_ids:
        changed_groups.append(group_name)
    groups[group_name] = sorted_ids

GROUPS_PATH.write_text(json.dumps(groups, indent=2) + "\n", encoding="utf-8")
print("resorted_groups=" + ", ".join(changed_groups))
print(f"changed_group_count={len(changed_groups)}")
if missing_palette_ids:
    unique_missing = sorted(set(missing_palette_ids))
    print("missing_palette_ids=" + ", ".join(str(x) for x in unique_missing[:50]))
