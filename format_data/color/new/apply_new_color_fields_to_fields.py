from __future__ import annotations

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
FIELDS_CSV_PATH = ROOT / "format_data" / "generated" / "fields.csv"
NEW_COLOR_CSV_PATH = ROOT / "format_data" / "generated" / "color" / "object_color_fields_new.csv"


def run() -> None:
    if not FIELDS_CSV_PATH.exists():
        raise FileNotFoundError(f"Missing fields CSV: {FIELDS_CSV_PATH}")
    if not NEW_COLOR_CSV_PATH.exists():
        raise FileNotFoundError(f"Missing new color CSV: {NEW_COLOR_CSV_PATH}")

    fields_df = pd.read_csv(FIELDS_CSV_PATH)
    color_df = pd.read_csv(NEW_COLOR_CSV_PATH)

    required = {"objectID"}
    if not required.issubset(color_df.columns):
        raise ValueError("object_color_fields_new.csv must include objectID")

    add_cols = [
        "top_color_hex",
        "dominant_colors_hex",
        "dominant_colors_share",
        "dominant_color_foreground_pixels",
        "colorgram_palette_hex",
        "colorgram_palette_share",
        "colorgram_palette_rgb",
        "colorgram_palette_hsl",
        "colorgram_dominant_hex",
        "colorgram_dominant_share",
    ]
    keep_cols = ["objectID"] + [col for col in add_cols if col in color_df.columns]
    color_df = color_df[keep_cols].drop_duplicates(subset=["objectID"], keep="last")

    merged = fields_df.rename(columns={"objectId": "objectID"}).merge(color_df, on="objectID", how="left")
    merged = merged.rename(columns={"objectID": "objectId"})
    merged.to_csv(FIELDS_CSV_PATH, index=False)
    print(f"Updated {FIELDS_CSV_PATH} with {len(color_df)} color rows from {NEW_COLOR_CSV_PATH}")


if __name__ == "__main__":
    run()

