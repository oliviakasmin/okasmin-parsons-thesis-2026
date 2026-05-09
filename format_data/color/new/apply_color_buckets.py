"""Assign color_bucket_* columns from colorgram palettes. Run from repo root:

python -m format_data.color.new.apply_color_buckets
python -m format_data.color.new.apply_color_buckets --input path/to.csv --output path/out.csv
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from .bucket_colors import assign_color_buckets

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_INPUT = ROOT / "format_data" / "generated" / "color" / "object_color_fields_new.csv"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Add color_bucket_labels / primary / debug to color CSV.")
    p.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="Input CSV with colorgram columns.")
    p.add_argument("--output", type=Path, default=None, help="Defaults to overwriting --input.")
    p.add_argument("--max-rows", type=int, default=None, help="Optional limit for smoke tests.")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    path = args.input
    if not path.exists():
        raise SystemExit(f"Missing input: {path}")

    out_path = args.output
    if args.max_rows is not None and out_path is None:
        out_path = path.parent / f"{path.stem}_bucket_sample{path.suffix}"
        print(f"--max-rows set: writing to {out_path} (source CSV unchanged).", flush=True)

    df = pd.read_csv(path)
    if args.max_rows is not None:
        df = df.iloc[: args.max_rows].copy()

    out_cols: list[dict[str, str]] = []
    for _idx, row in df.iterrows():
        out_cols.append(assign_color_buckets(row))
    extra = pd.DataFrame(out_cols)
    for c in extra.columns:
        df[c] = extra[c].values

    out_path = out_path or path
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, index=False)
    print(f"Wrote {len(df)} rows to {out_path}")


if __name__ == "__main__":
    main()
