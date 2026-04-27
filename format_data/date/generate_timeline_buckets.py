"""Generate static timeline bucket metadata JSON.

Run from repo root:
python -m format_data.date.generate_timeline_buckets
"""

from pathlib import Path
import json
import pandas as pd

from .get_date import get_date_field

ROOT = Path(__file__).resolve().parents[2]
OBJECTS_JSON_PATH = ROOT / "fetch_data" / "data" / "objects.json"
TIMELINE_BUCKETS_JSON_PATH = Path(__file__).resolve().parent / "timeline_buckets.json"


def load_objects_df(path: Path) -> pd.DataFrame:
    with path.open("r", encoding="utf-8") as file:
        raw = json.load(file)
    return pd.DataFrame.from_dict(raw, orient="index").reset_index(drop=True)


def build_timeline_buckets_payload(df: pd.DataFrame) -> dict[str, dict[str, int | str]]:
    required_cols = [
        "final_date_bucket_key",
        "final_date_bucket_start",
        "final_date_bucket_end",
        "final_date_bucket_label",
    ]
    if not all(col in df.columns for col in required_cols):
        return {}

    buckets_df = df[required_cols].dropna(subset=["final_date_bucket_key"]).drop_duplicates(
        subset=["final_date_bucket_key"], keep="first"
    )

    if buckets_df.empty:
        return {}

    buckets_df = buckets_df.sort_values(by=["final_date_bucket_start", "final_date_bucket_end"])
    return {
        str(row["final_date_bucket_key"]): {
            "final_date_bucket_start": int(row["final_date_bucket_start"]),
            "final_date_bucket_end": int(row["final_date_bucket_end"]),
            "final_date_bucket_label": str(row["final_date_bucket_label"]),
        }
        for _, row in buckets_df.iterrows()
    }


def main() -> None:
    objects_df = load_objects_df(OBJECTS_JSON_PATH)
    dated_df = get_date_field(objects_df)
    payload = build_timeline_buckets_payload(dated_df)
    TIMELINE_BUCKETS_JSON_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Saved timeline buckets to {TIMELINE_BUCKETS_JSON_PATH}")


if __name__ == "__main__":
    main()
