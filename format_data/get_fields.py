# Run from repo root:
# python -m format_data.get_fields

from pathlib import Path
import json
import pandas as pd
from .date.get_date import get_date_field
from .function_groups.get_object_function_group import map_function_group
from .place.get_location_fields import get_location_field
from .place.apply_geo_contract import apply_geo_contract_df
from .place.geocode_locations import CACHE_CSV_PATH

ROOT = Path(__file__).resolve().parents[1]
OBJECTS_JSON_PATH = ROOT / "fetch_data" / "data" / "objects.json"
OUTPUT_CSV_PATH = Path(__file__).resolve().parent / "generated" / "fields.csv"
COLOR_FIELDS_CSV_PATH = Path(__file__).resolve().parent / "generated" / "object_color_fields.csv"




def load_objects_df(path: Path) -> pd.DataFrame:
    with path.open("r", encoding="utf-8") as f:
        raw = json.load(f)
    return pd.DataFrame.from_dict(raw, orient="index").reset_index(drop=True)




def add_geo_llm_fields(df: pd.DataFrame) -> pd.DataFrame:
    """Apply geo contract and return df with geo_normalized_* columns."""
    return apply_geo_contract_df(df)


def add_function_group_field(df: pd.DataFrame) -> pd.DataFrame:
    """Derive final_group from objectName/title (same rules as object_function_groups.csv)."""
    out = df.copy()
    names = (
        out["objectName"].fillna("").astype(str)
        if "objectName" in out.columns
        else pd.Series([""] * len(out))
    )
    titles = (
        out["title"].fillna("").astype(str) if "title" in out.columns else pd.Series([""] * len(out))
    )
    out["final_group"] = [map_function_group(o, t) for o, t in zip(names, titles)]
    return out


def add_geocoded_location_fields(df: pd.DataFrame) -> pd.DataFrame:
    """Join cached Mapbox geocodes by normalized location string."""
    out = df.copy()
    mapbox_cols = [
        "mapbox_feature_id",
        "mapbox_place_name",
        "geo_mapbox_lon",
        "geo_mapbox_lat",
        "geo_mapbox_relevance",
        "geo_mapbox_accuracy",
        "geo_mapbox_match_status",
        "geo_mapbox_updated_at",
    ]

    if not CACHE_CSV_PATH.exists():
        for col in mapbox_cols:
            out[col] = ""
        return out

    cache_df = pd.read_csv(CACHE_CSV_PATH)
    if "query" not in cache_df.columns:
        for col in mapbox_cols:
            out[col] = ""
        return out

    keep_cols = ["query"] + [c for c in mapbox_cols if c in cache_df.columns]
    cache_df = cache_df[keep_cols].drop_duplicates(subset=["query"], keep="last")
    cache_df = cache_df.rename(columns={"query": "geo_normalized_best_guess_location"})

    out = out.merge(cache_df, on="geo_normalized_best_guess_location", how="left")
    return out


def add_color_fields(df: pd.DataFrame) -> pd.DataFrame:
    """Join generated per-object color fields by objectID."""
    out = df.copy()
    color_cols = [
        "color_eligible",
        "top_color_hex",
        "dominant_colors_hex",
        "color_group_id",
    ]
    if not COLOR_FIELDS_CSV_PATH.exists():
        for col in color_cols:
            out[col] = ""
        return out

    color_df = pd.read_csv(COLOR_FIELDS_CSV_PATH)
    if "objectID" not in color_df.columns:
        for col in color_cols:
            out[col] = ""
        return out

    keep_cols = ["objectID"] + [c for c in color_cols if c in color_df.columns]
    color_df = color_df[keep_cols].drop_duplicates(subset=["objectID"], keep="last")
    out = out.merge(color_df, on="objectID", how="left")
    return out


def build_fields(df: pd.DataFrame) -> pd.DataFrame:
    df = get_date_field(df)
    df = get_location_field(df)
    df = add_geo_llm_fields(df)
    df = add_geocoded_location_fields(df)
    df = add_function_group_field(df)
    df = add_color_fields(df)

    out = df[
        [
            "objectID",
            "department",
            "final_group",
            "objectBeginDate",
            "objectEndDate",
            "final_date",
            "final_date_bucket_key",
            "geo_options",
            "geo_normalized_best_guess_location",
            "geo_normalized_source_cols",
            "geo_normalized_confidence",
            "geo_normalized_geo_eligible",
            "mapbox_feature_id",
            "mapbox_place_name",
            "geo_mapbox_lon",
            "geo_mapbox_lat",
            "geo_mapbox_relevance",
            "geo_mapbox_accuracy",
            "geo_mapbox_match_status",
            "geo_mapbox_updated_at",
            "color_eligible",
            "top_color_hex",
            "dominant_colors_hex",
            "color_group_id",
        ]
    ].copy()
    out = out.rename(columns={"objectID": "objectId"})
    return out


def main() -> None:
    df = load_objects_df(OBJECTS_JSON_PATH)
    out = build_fields(df)
    out.to_csv(OUTPUT_CSV_PATH, index=False)
    print(f"Saved {len(out)} rows to {OUTPUT_CSV_PATH}")


if __name__ == "__main__":
    main()



