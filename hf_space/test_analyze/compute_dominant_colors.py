#!/usr/bin/env python3
"""Compute dominant hue per standardized no-bg vessel image."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

INPUT_DIR = Path("hf_space/pipeline/test_images")
OUTPUT_JSON = Path("test_assets/dominant_colors.json")
FILENAME_SUFFIX = "_no_bg_standardized.png"
ALPHA_THRESHOLD = 32


def rgb_to_hue(r: float, g: float, b: float) -> float:
    r_norm = r / 255.0
    g_norm = g / 255.0
    b_norm = b / 255.0
    max_val = max(r_norm, g_norm, b_norm)
    min_val = min(r_norm, g_norm, b_norm)
    delta = max_val - min_val
    if delta == 0:
        return 0.0
    if max_val == r_norm:
        hue = ((g_norm - b_norm) / delta) % 6
    elif max_val == g_norm:
        hue = ((b_norm - r_norm) / delta) + 2
    else:
        hue = ((r_norm - g_norm) / delta) + 4
    degrees = hue * 60.0
    return degrees + 360.0 if degrees < 0 else degrees


def dominant_hue_for_image(path: Path) -> float | None:
    with Image.open(path).convert("RGBA") as image:
        r_sum = 0.0
        g_sum = 0.0
        b_sum = 0.0
        weight_sum = 0.0
        for r, g, b, a in image.getdata():
            if a < ALPHA_THRESHOLD:
                continue
            weight = a / 255.0
            r_sum += r * weight
            g_sum += g * weight
            b_sum += b * weight
            weight_sum += weight
        if weight_sum == 0:
            return None
        return rgb_to_hue(r_sum / weight_sum, g_sum / weight_sum, b_sum / weight_sum)


def main() -> None:
    hue_by_object_id: dict[str, float] = {}
    image_paths = sorted(INPUT_DIR.glob(f"*{FILENAME_SUFFIX}"))
    for image_path in image_paths:
        object_id = image_path.name[: -len(FILENAME_SUFFIX)]
        dominant_hue = dominant_hue_for_image(image_path)
        if dominant_hue is None:
            continue
        hue_by_object_id[object_id] = round(dominant_hue, 3)

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    payload = {"hue_by_object_id": hue_by_object_id, "count": len(hue_by_object_id)}
    OUTPUT_JSON.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_JSON} with {len(hue_by_object_id)} entries.")


if __name__ == "__main__":
    main()
