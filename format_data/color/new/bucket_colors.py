"""Per-object color buckets from Colorgram palette RGB + proportions.

Each swatch is assigned exactly one internal *family* (via ordered HSV checks in
``color_family``). Families are aggregated, then ``classify_palette`` maps to
exactly one user-facing string in ``COLOR_BUCKETS``. Internal family names are
not the same as bucket labels.
"""

from __future__ import annotations

import colorsys
import json
from collections import defaultdict
from typing import Any, Mapping, TypedDict

COLOR_BUCKETS = [
    "blue and white",
    "terracotta",
    "tan stoneware",
    "white / cream",
    "black / dark",
    "green / celadon",
    "yellow / ochre",
    "red / orange",
    "brown / earth tone",
    "gray / neutral",
    "multicolor",
    "mixed / other",
]

_COLOR_BUCKET_SET = frozenset(COLOR_BUCKETS)

# Gates for classify_palette (proportion thresholds on aggregated families)
CLASSIFY_THRESHOLDS: dict[str, float | int] = {
    "blue_and_white_blue_min": 0.16,
    "blue_and_white_light_min": 0.25,
    "meaningful_family_min_prop": 0.10,
    "meaningful_families_min_count": 4,
    "terracotta_min": 0.35,
    "tan_stoneware_tan_min": 0.40,
    "tan_stoneware_neutral_min": 0.60,
    "white_cream_min": 0.55,
    "black_dark_min": 0.45,
    "green_min": 0.30,
    "yellow_min": 0.28,
    "red_orange_min": 0.35,
    "brown_min": 0.35,
    "earth_total_min": 0.65,
    "gray_min": 0.45,
    "warm_fallback_min": 0.45,
}


class PaletteItem(TypedDict):
    rgb: tuple[int, int, int]
    proportion: float


def rgb_to_hsv(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    r, g, b = [x / 255.0 for x in rgb]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    return h * 360.0, s, v


def color_family(rgb: tuple[int, int, int]) -> str:
    h, s, v = rgb_to_hsv(rgb)

    if v < 0.18:
        return "black"
    if s < 0.10 and v > 0.78:
        return "white"
    if s < 0.14:
        return "gray"

    if 185 <= h <= 255 and s > 0.16:
        return "blue"

    if 75 <= h <= 170 and s > 0.12:
        return "green"

    if 8 <= h <= 32 and 0.28 <= s <= 0.75 and 0.22 <= v <= 0.78:
        return "terracotta"

    if h <= 12 or h >= 345:
        return "red"

    if 12 < h <= 42 and s > 0.35:
        return "orange"

    if 42 < h <= 70 and s > 0.22:
        return "yellow"

    if 28 <= h <= 65 and 0.10 <= s <= 0.42 and v > 0.38:
        return "tan"

    if 12 <= h <= 55 and v < 0.55:
        return "brown"

    return "other"


def classify_palette(
    palette: list[PaletteItem],
    thresholds: dict[str, float | int] | None = None,
) -> dict[str, Any]:
    cfg = CLASSIFY_THRESHOLDS if thresholds is None else thresholds
    totals: defaultdict[str, float] = defaultdict(float)

    for item in palette:
        family = color_family(item["rgb"])
        totals[family] += item["proportion"]

    blue = totals["blue"]
    light = totals["white"] + totals["tan"]
    terracotta = totals["terracotta"]
    tan = totals["tan"]
    white = totals["white"]
    dark = totals["black"]
    green = totals["green"]
    yellow = totals["yellow"]
    red_orange = totals["red"] + totals["orange"]
    brown = totals["brown"]
    gray = totals["gray"]

    earth_total = terracotta + tan + brown
    neutral_total = white + tan + gray + brown
    warm_total = terracotta + red_orange + yellow + brown

    mf_min = float(cfg["meaningful_family_min_prop"])
    mf_count = int(cfg["meaningful_families_min_count"])
    meaningful_families = sum(
        1
        for family, prop in totals.items()
        if prop >= mf_min and family not in ("white", "gray", "black")
    )

    if blue >= float(cfg["blue_and_white_blue_min"]) and light >= float(cfg["blue_and_white_light_min"]):
        bucket = "blue and white"
    elif meaningful_families >= mf_count:
        bucket = "multicolor"
    elif terracotta >= float(cfg["terracotta_min"]) and terracotta >= tan and terracotta >= brown:
        bucket = "terracotta"
    elif tan >= float(cfg["tan_stoneware_tan_min"]) and neutral_total >= float(cfg["tan_stoneware_neutral_min"]):
        bucket = "tan stoneware"
    elif white >= float(cfg["white_cream_min"]):
        bucket = "white / cream"
    elif dark >= float(cfg["black_dark_min"]):
        bucket = "black / dark"
    elif green >= float(cfg["green_min"]):
        bucket = "green / celadon"
    elif yellow >= float(cfg["yellow_min"]):
        bucket = "yellow / ochre"
    elif red_orange >= float(cfg["red_orange_min"]):
        bucket = "red / orange"
    elif brown >= float(cfg["brown_min"]) or earth_total >= float(cfg["earth_total_min"]):
        bucket = "brown / earth tone"
    elif gray >= float(cfg["gray_min"]):
        bucket = "gray / neutral"
    elif warm_total >= float(cfg["warm_fallback_min"]):
        bucket = "brown / earth tone"
    else:
        bucket = "mixed / other"

    return {
        "bucket": bucket,
        "family_totals": dict(totals),
        "derived": {
            "light": light,
            "earth_total": earth_total,
            "neutral_total": neutral_total,
            "warm_total": warm_total,
            "meaningful_families": meaningful_families,
        },
    }


def _parse_json_list(raw: Any) -> list:
    if raw is None or (isinstance(raw, float) and str(raw) == "nan"):
        return []
    if isinstance(raw, list):
        return raw
    s = str(raw).strip()
    if not s:
        return []
    try:
        v = json.loads(s)
        return v if isinstance(v, list) else []
    except json.JSONDecodeError:
        return []


def _hex_to_rgb(hx: str) -> tuple[int, int, int] | None:
    s = hx.strip().lstrip("#")
    if len(s) != 6:
        return None
    try:
        return int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16)
    except ValueError:
        return None


def parse_palette_row(row: Mapping[str, Any]) -> list[PaletteItem]:
    hexes = _parse_json_list(row.get("colorgram_palette_hex"))
    rgb_rows = _parse_json_list(row.get("colorgram_palette_rgb"))
    shares_raw = _parse_json_list(row.get("colorgram_palette_share"))

    shares: list[float] = []
    for x in shares_raw:
        try:
            shares.append(float(x))
        except (TypeError, ValueError):
            shares.append(0.0)

    lens: list[int] = [len(shares)]
    if rgb_rows:
        lens.append(len(rgb_rows))
    if hexes:
        lens.append(len(hexes))
    n = min(lens) if lens and min(lens) > 0 else 0

    out: list[PaletteItem] = []
    for i in range(n):
        rgb: tuple[int, int, int] | None = None
        if i < len(rgb_rows) and isinstance(rgb_rows[i], (list, tuple)) and len(rgb_rows[i]) >= 3:
            try:
                rgb = (int(rgb_rows[i][0]), int(rgb_rows[i][1]), int(rgb_rows[i][2]))
            except (TypeError, ValueError):
                rgb = None
        if rgb is None and i < len(hexes):
            parsed = _hex_to_rgb(str(hexes[i]))
            rgb = parsed if parsed is not None else (0, 0, 0)
        if rgb is None:
            rgb = (0, 0, 0)
        prop = float(shares[i]) if i < len(shares) else 0.0
        out.append({"rgb": rgb, "proportion": prop})

    total = sum(item["proportion"] for item in out)
    if total > 0:
        for item in out:
            item["proportion"] = item["proportion"] / total

    return out


def assign_color_buckets(row_or_series: Mapping[str, Any] | Any) -> dict[str, str]:
    """Return color_bucket_labels (JSON array of one label), primary, debug JSON."""
    row: Mapping[str, Any]
    if isinstance(row_or_series, Mapping):
        row = dict(row_or_series)
    elif hasattr(row_or_series, "to_dict"):
        row = dict(row_or_series.to_dict())  # type: ignore[no-untyped-call]
    elif hasattr(row_or_series, "get"):
        row = dict(row_or_series)  # type: ignore[arg-type]
    else:
        row = {}

    empty = {"color_bucket_labels": "[]", "color_bucket_primary": "", "color_bucket_debug": "{}"}
    status = str(row.get("color_analysis_status") or "").strip()
    if status == "bw_original":
        return empty

    palette = parse_palette_row(row)
    if not palette:
        return {
            "color_bucket_labels": json.dumps(["mixed / other"], ensure_ascii=False),
            "color_bucket_primary": "mixed / other",
            "color_bucket_debug": json.dumps(
                {"bucket": "mixed / other", "family_totals": {}, "reason": "empty_palette"},
                ensure_ascii=False,
            ),
        }

    result = classify_palette(palette)
    bucket = str(result["bucket"])
    if bucket not in _COLOR_BUCKET_SET:
        bucket = "mixed / other"

    debug = {
        "bucket": bucket,
        "family_totals": result["family_totals"],
        "derived": result.get("derived"),
    }

    return {
        "color_bucket_labels": json.dumps([bucket], ensure_ascii=False),
        "color_bucket_primary": bucket,
        "color_bucket_debug": json.dumps(debug, ensure_ascii=False),
    }
