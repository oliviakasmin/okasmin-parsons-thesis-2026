from __future__ import annotations

import pandas as pd

# Analyze geo_options to return location that is readable for Leaflet/Nominatim/Mapbox/Google on Frontend
# order of geography_cols array is in order of preference
# "artistNationality" is the LAST CHOICE and should not be used to inform any other columns - for example "French" can be turned into "France"
# "city","state","region","country" can all be used to inform one another. "culture" can also be used to inform if need more information
# "culture" is more broad but a good fallback 

geography_cols = [
    "city",
    "state",
    "region",
    "country",
    "culture",
    "artistNationality",
]

MISSING_TOKEN = ""

def _clean_geo_value(series: pd.Series) -> pd.Series:
    s = series.astype("string").str.strip()
    missing_mask = s.isna() | s.eq("") | s.str.lower().eq("undefined")
    return s.mask(missing_mask, MISSING_TOKEN)


def get_location_field(df: pd.DataFrame) -> pd.DataFrame:
    # Build a pipe-delimited set of all geo columns, keeping placeholders for missing values.
    geo_frame = pd.DataFrame({col: _clean_geo_value(df[col]) for col in geography_cols})
    df["geo_options"] = geo_frame.agg("||".join, axis=1)
    return df