# Run from repo root:
# python -m format_data.get_fields

from pathlib import Path
import json
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OBJECTS_JSON_PATH = ROOT / "fetch_data" / "data" / "objects.json"
OUTPUT_CSV_PATH = Path(__file__).resolve().parent / "fields.csv"

MISSING_TOKEN = ""

date_cols = ["objectBeginDate", "objectEndDate"]
geography_cols = [
    "city",
    "state",
    "region",
    "country",
    "culture",
    "artistNationality",
]

def load_objects_df(path: Path) -> pd.DataFrame:
    with path.open("r", encoding="utf-8") as f:
        raw = json.load(f)
    return pd.DataFrame.from_dict(raw, orient="index").reset_index(drop=True)


def get_date_field(df: pd.DataFrame) -> pd.DataFrame:
    b = pd.to_numeric(df["objectBeginDate"], errors="coerce")
    e = pd.to_numeric(df["objectEndDate"], errors="coerce")
    mid = ((b + e) / 2).where(b.notna() & e.notna())
    # Floor towards negative infinity to preserve signed-year behavior.
    df["final_date"] = (mid // 1).where(mid.notna()).astype("Int64")
    return df


def _clean_geo_value(series: pd.Series) -> pd.Series:
    s = series.astype("string").str.strip()
    missing_mask = s.isna() | s.eq("") | s.str.lower().eq("undefined")
    return s.mask(missing_mask, MISSING_TOKEN)


def get_location_field(df: pd.DataFrame) -> pd.DataFrame:
    # Build a pipe-delimited set of all geo columns, keeping placeholders for missing values.
    geo_frame = pd.DataFrame({col: _clean_geo_value(df[col]) for col in geography_cols})
    df["geo_options"] = geo_frame.agg("||".join, axis=1)
    return df


def build_fields(df: pd.DataFrame) -> pd.DataFrame:
    df = get_date_field(df)
    df = get_location_field(df)

    out = df[["objectID", "department", "final_date", "geo_options"]].copy()
    out = out.rename(columns={"objectID": "objectId"})
    return out


def main() -> None:
    df = load_objects_df(OBJECTS_JSON_PATH)
    out = build_fields(df)
    out.to_csv(OUTPUT_CSV_PATH, index=False)
    print(f"Saved {len(out)} rows to {OUTPUT_CSV_PATH}")


if __name__ == "__main__":
    main()



# Analyze geo_options to return location that is readable for Leaflet/Nominatim/Mapbox/Google on Frontend
# order of geography_cols array is in order of preference
# "artistNationality" is the LAST CHOICE and should not be used to inform any other columns - for example "French" can be turned into "France"
# "city","state","region","country" can all be used to inform one another. "culture" can also be used to inform if need more information
# "culture" is more broad but a good fallback 