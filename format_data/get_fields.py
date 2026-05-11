# Run from repo root:
# python -m format_data.get_fields

from pathlib import Path
import json
import pandas as pd
from .date.get_date import get_date_field
from .place.get_location_fields import get_location_field
from .place.apply_geo_contract import apply_geo_contract_df
from .place.geocode_locations import CACHE_CSV_PATH
from .use_groups.get_use import classify_title, _load_mapping_module

ROOT = Path(__file__).resolve().parents[1]
OBJECTS_JSON_PATH = ROOT / "fetch_data" / "data" / "objects.json"
OUTPUT_CSV_PATH = Path(__file__).resolve().parent / "generated" / "fields.csv"
OBJECT_ID_COLUMN = "objectID"
COLOR_FIELDS_CSV_PATH = Path(__file__).resolve().parent / "generated" / "color" / "object_color_fields.csv"
NEW_COLOR_FIELDS_CSV_PATH = Path(__file__).resolve().parent / "generated" / "color" / "object_color_fields_new.csv"
COLOR_KMEANS_CLUSTERS_CSV_PATH = Path(__file__).resolve().parent / "generated" / "color" / "object_color_kmeans_clusters.csv"
CLUSTER_FIELDS_CSV_PATH = Path(__file__).resolve().parent / "cluster_shape" / "final_clusters_object_ids.csv"




def load_objects_df(path: Path) -> pd.DataFrame:
    with path.open("r", encoding="utf-8") as f:
        raw = json.load(f)
    return pd.DataFrame.from_dict(raw, orient="index").reset_index(drop=True)




def add_geo_llm_fields(df: pd.DataFrame) -> pd.DataFrame:
    """Apply geo contract and return df with geo_normalized_* columns."""
    return apply_geo_contract_df(df)


def add_use_field(df: pd.DataFrame) -> pd.DataFrame:
    """Derive use from title (same rules as format_data/use_groups/get_use.py)."""
    out = df.copy()
    mod = _load_mapping_module()
    titles = (
        out["title"].fillna("").astype(str) if "title" in out.columns else pd.Series([""] * len(out))
    )
    out["use"] = [classify_title(t, mod) for t in titles]
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


def _mask_nonempty_colorgram_palette(palette_series: pd.Series) -> pd.Series:
    s = palette_series.astype(str).str.strip()
    return s.notna() & (s != "") & (s != "nan") & (s != "[]")


def sync_legacy_visual_palette_from_colorgram(df: pd.DataFrame) -> pd.DataFrame:
    """Align legacy modal/top-color columns with the latest colorgram palette when present.

    Frontend still reads ``dominant_colors_hex`` (e.g. object modal); Test2 reads
    ``colorgram_palette_hex``. After merging sources, both point at the same snapshot where
    colorgram data exists.
    """
    out = df.copy()
    if "colorgram_palette_hex" not in out.columns:
        return out
    mask = _mask_nonempty_colorgram_palette(out["colorgram_palette_hex"])
    if not bool(mask.any()):
        return out
    if "dominant_colors_hex" in out.columns:
        out.loc[mask, "dominant_colors_hex"] = out.loc[mask, "colorgram_palette_hex"]
    if "dominant_colors_share" in out.columns and "colorgram_palette_share" in out.columns:
        out.loc[mask, "dominant_colors_share"] = out.loc[mask, "colorgram_palette_share"]
    if "top_color_hex" in out.columns and "colorgram_dominant_hex" in out.columns:
        sub = out.loc[mask]
        cd = sub["colorgram_dominant_hex"].astype(str).str.strip()
        ok = cd.notna() & (cd != "") & (cd != "nan")
        idx = sub.index[ok]
        out.loc[idx, "top_color_hex"] = out.loc[idx, "colorgram_dominant_hex"]
    return out


def add_color_fields(df: pd.DataFrame) -> pd.DataFrame:
    """Join generated per-object color fields by objectID."""
    out = df.copy()
    legacy_color_cols = [
        "color_eligible",
        "color_analysis_status",
        "top_color_hex",
        "dominant_colors_hex",
        "color_group_id",
        "color_group_key",
        "color_group_type",
        "color_group_confidence",
    ]
    new_color_cols = [
        "dominant_colors_share",
        "dominant_color_foreground_pixels",
        "colorgram_palette_hex",
        "colorgram_palette_share",
        "colorgram_palette_rgb",
        "colorgram_palette_hsl",
        "colorgram_dominant_hex",
        "colorgram_dominant_share",
        "color_bucket_labels",
        "color_bucket_primary",
        "color_bucket_debug",
    ]
    color_cols = legacy_color_cols + new_color_cols

    if (not COLOR_FIELDS_CSV_PATH.exists()) and (not NEW_COLOR_FIELDS_CSV_PATH.exists()):
        for col in color_cols:
            out[col] = ""
        return out

    color_frames: list[pd.DataFrame] = []
    if COLOR_FIELDS_CSV_PATH.exists():
        color_frames.append(pd.read_csv(COLOR_FIELDS_CSV_PATH))
    if NEW_COLOR_FIELDS_CSV_PATH.exists():
        color_frames.append(pd.read_csv(NEW_COLOR_FIELDS_CSV_PATH))

    if not color_frames:
        for col in color_cols:
            out[col] = ""
        return out

    # Legacy CSV first, then ``object_color_fields_new.csv``, so ``keep="last"`` prefers the
    # newest pipeline row per object for overlapping columns (including ``colorgram_palette_hex``).
    color_df = pd.concat(color_frames, ignore_index=True, sort=False)
    if OBJECT_ID_COLUMN not in color_df.columns:
        for col in color_cols:
            out[col] = ""
        return out

    keep_cols = [OBJECT_ID_COLUMN] + [c for c in color_cols if c in color_df.columns]
    color_df = color_df[keep_cols].drop_duplicates(subset=[OBJECT_ID_COLUMN], keep="last")

    # New color snapshots (e.g. object_color_fields_new.csv) often omit color_group_* columns.
    # Concat + keep="last" then leaves NaN for groups on overlapping IDs. Re-attach groups from
    # legacy object_color_fields.csv so Shelf / useColorGroups counts stay populated.
    legacy_group_cols = [
        "color_group_id",
        "color_group_key",
        "color_group_type",
        "color_group_confidence",
    ]
    if COLOR_FIELDS_CSV_PATH.exists():
        legacy_df = pd.read_csv(COLOR_FIELDS_CSV_PATH)
        if "objectID" in legacy_df.columns:
            lg_keep = ["objectID"] + [c for c in legacy_group_cols if c in legacy_df.columns]
            if len(lg_keep) > 1:
                legacy_groups = legacy_df[lg_keep].drop_duplicates(
                    subset=[OBJECT_ID_COLUMN], keep="last"
                )
                color_df = color_df.drop(
                    columns=[c for c in legacy_group_cols if c in color_df.columns],
                    errors="ignore",
                )
                color_df = color_df.merge(legacy_groups, on=OBJECT_ID_COLUMN, how="left")

    out = out.merge(color_df, on=OBJECT_ID_COLUMN, how="left")
    out = sync_legacy_visual_palette_from_colorgram(out)
    return out


def add_color_kmeans_clusters(df: pd.DataFrame) -> pd.DataFrame:
    """Join palette KMeans cluster id by objectID (optional generated file)."""
    out = df.copy()
    kmeans_cols = ["color_kmeans_cluster", "color_kmeans_k", "color_kmeans_feature_version"]
    if not COLOR_KMEANS_CLUSTERS_CSV_PATH.exists():
        for col in kmeans_cols:
            out[col] = ""
        return out

    kdf = pd.read_csv(COLOR_KMEANS_CLUSTERS_CSV_PATH)
    if "objectID" not in kdf.columns:
        for col in kmeans_cols:
            out[col] = ""
        return out

    keep = ["objectID"] + [c for c in kmeans_cols if c in kdf.columns]
    kdf = kdf[keep].drop_duplicates(subset=[OBJECT_ID_COLUMN], keep="last")
    out = out.merge(kdf, on=OBJECT_ID_COLUMN, how="left")
    return out


def add_cluster_group_fields(df: pd.DataFrame) -> pd.DataFrame:
    """Join final shape cluster group by objectID."""
    out = df.copy()
    cluster_cols = ["shape_cluster_group", "shape_cluster_type"]
    if not CLUSTER_FIELDS_CSV_PATH.exists():
        for col in cluster_cols:
            out[col] = ""
        return out

    cluster_df = pd.read_csv(CLUSTER_FIELDS_CSV_PATH)
    required_cols = {"object_id", "cluster"}
    if not required_cols.issubset(cluster_df.columns):
        for col in cluster_cols:
            out[col] = ""
        return out

    if "cluster_type" not in cluster_df.columns:
        cluster_df["cluster_type"] = ""

    cluster_df = (
        cluster_df[["object_id", "cluster", "cluster_type"]]
        .rename(
            columns={
                "object_id": "objectID",
                "cluster": "shape_cluster_group",
                "cluster_type": "shape_cluster_type",
            }
        )
        .drop_duplicates(subset=[OBJECT_ID_COLUMN], keep="last")
    )
    out = out.merge(cluster_df, on=OBJECT_ID_COLUMN, how="left")
    return out


def build_fields(df: pd.DataFrame) -> pd.DataFrame:
    df = get_date_field(df)
    df = get_location_field(df)
    df = add_geo_llm_fields(df)
    df = add_geocoded_location_fields(df)
    df = add_use_field(df)
    df = add_color_fields(df)
    df = add_color_kmeans_clusters(df)
    df = add_cluster_group_fields(df)

    # One row per object; ``keep="last"`` matches color CSV precedence above.
    df = df.drop_duplicates(subset=[OBJECT_ID_COLUMN], keep="last").reset_index(drop=True)

    out = df[
        [
            "objectID",
            "department",
            "title",
            "use",
            "shape_cluster_group",
            "shape_cluster_type",
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
            "color_analysis_status",
            "top_color_hex",
            "dominant_colors_hex",
            "dominant_colors_share",
            "dominant_color_foreground_pixels",
            "color_group_id",
            "color_group_key",
            "color_group_type",
            "color_group_confidence",
            "colorgram_palette_hex",
            "colorgram_palette_share",
            "colorgram_palette_rgb",
            "colorgram_palette_hsl",
            "colorgram_dominant_hex",
            "colorgram_dominant_share",
            "color_bucket_labels",
            "color_bucket_primary",
            "color_bucket_debug",
            "color_kmeans_cluster",
            "color_kmeans_k",
            "color_kmeans_feature_version",
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



