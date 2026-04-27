import pandas as pd

date_cols = ["objectBeginDate", "objectEndDate"]
BUCKET_SIZE_YEARS = 500


def _format_bucket_label(start_year: int, end_year: int) -> str:
    displayed_end_year = end_year + 1

    if start_year < 0 and displayed_end_year < 0:
        return f"{abs(start_year)} - {abs(displayed_end_year)} BCE"

    if start_year < 0 and displayed_end_year == 0:
        return f"{abs(start_year)} BCE - 0"

    if start_year == 0 and displayed_end_year > 0:
        return f"0 - {displayed_end_year} CE"

    if start_year > 0 and displayed_end_year > 0:
        return f"{start_year} - {displayed_end_year} CE"

    def format_single_year(year: int) -> str:
        if year < 0:
            return f"{abs(year)} BCE"
        if year > 0:
            return f"{year} CE"
        return "0"

    return f"{format_single_year(start_year)} - {format_single_year(displayed_end_year)}"

def get_date_field(df: pd.DataFrame) -> pd.DataFrame:
    b = pd.to_numeric(df["objectBeginDate"], errors="coerce")
    e = pd.to_numeric(df["objectEndDate"], errors="coerce")
    mid = ((b + e) / 2).where(b.notna() & e.notna())
    # Floor towards negative infinity to preserve signed-year behavior.
    df["final_date"] = (mid // 1).where(mid.notna()).astype("Int64")
    bucket_start = ((df["final_date"] // BUCKET_SIZE_YEARS) * BUCKET_SIZE_YEARS).astype("Int64")
    bucket_end = (bucket_start + (BUCKET_SIZE_YEARS - 1)).astype("Int64")
    df["final_date_bucket_start"] = bucket_start
    df["final_date_bucket_end"] = bucket_end

    df["final_date_bucket_key"] = pd.Series(pd.NA, index=df.index, dtype="object")
    has_bucket = bucket_start.notna() & bucket_end.notna()
    df.loc[has_bucket, "final_date_bucket_key"] = (
        bucket_start[has_bucket].astype(int).astype(str)
        + ":"
        + bucket_end[has_bucket].astype(int).astype(str)
    )

    df["final_date_bucket_label"] = pd.Series(pd.NA, index=df.index, dtype="object")
    df.loc[has_bucket, "final_date_bucket_label"] = [
        _format_bucket_label(int(start), int(end))
        for start, end in zip(bucket_start[has_bucket], bucket_end[has_bucket])
    ]
    return df
