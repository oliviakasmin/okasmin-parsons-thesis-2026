from __future__ import annotations

# Run from repo root:
# python -m format_data.get_fields
# python -m format_data.place.geocode_locations
# Optional throttle for safer first run:
# python -m format_data.place.geocode_locations --sleep-seconds 0.2
# Requires MAPBOX_TOKEN in environment or repo-root .env file.

import argparse
import json
import os
import random
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parent
INPUT_CSV_PATH = ROOT / "generated" / "fields.csv"
GEOCODE_OUTPUT_DIR = ROOT / "generated" / "geocode"
OUTPUT_CSV_PATH = GEOCODE_OUTPUT_DIR / "fields_geocoded.csv"
OUTPUT_JSON_PATH = GEOCODE_OUTPUT_DIR / "fields_geocoded.json"
CACHE_CSV_PATH = GEOCODE_OUTPUT_DIR / "geocode_cache.csv"
CACHE_JSON_PATH = GEOCODE_OUTPUT_DIR / "geocode_cache.json"
ENV_PATH = REPO_ROOT / ".env"

MAPBOX_ENDPOINT = "https://api.mapbox.com/geocoding/v5/mapbox.places"
DEFAULT_TIMEOUT_SECONDS = 20.0
DEFAULT_RETRIES = 4
DEFAULT_BACKOFF_SECONDS = 1.0
PROGRESS_EVERY = 25
DEFAULT_TYPES = "country,region,district,place"
UNCERTAIN_TYPES = "country,region"
COUNTRY_TO_ISO2 = {
    "united states": "us",
    "usa": "us",
    "britain": "gb",
    "united kingdom": "gb",
    "england": "gb",
    "scotland": "gb",
    "france": "fr",
    "germany": "de",
    "italy": "it",
    "spain": "es",
    "netherlands": "nl",
    "switzerland": "ch",
    "belgium": "be",
    "czech republic": "cz",
    "denmark": "dk",
    "russia": "ru",
    "ireland": "ie",
    "china": "cn",
    "japan": "jp",
    "korea": "kr",
    "iran": "ir",
    "iraq": "iq",
    "syria": "sy",
    "egypt": "eg",
    "turkey": "tr",
    "greece": "gr",
    "mexico": "mx",
    "peru": "pe",
    "guatemala": "gt",
    "vietnam": "vn",
    "cyprus": "cy",
    "thailand": "th",
    "india": "in",
    "ghana": "gh",
    "mali": "ml",
    "ecuador": "ec",
    "colombia": "co",
    "panama": "pa",
}
UK_SUBNATIONALS = {"scotland", "england", "wales", "northern ireland"}


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def _utc_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _safe_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _clean_query(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _empty_result(query: str, status: str) -> dict[str, Any]:
    return {
        "query": query,
        "source_key": "",
        "mapbox_types": "",
        "mapbox_country": "",
        "mapbox_feature_id": "",
        "mapbox_place_name": "",
        "geo_mapbox_lon": None,
        "geo_mapbox_lat": None,
        "geo_mapbox_relevance": None,
        "geo_mapbox_accuracy": "",
        "geo_mapbox_match_status": status,
        "geo_mapbox_updated_at": _utc_now(),
    }


def _build_accuracy(feature: dict[str, Any]) -> str:
    place_type = feature.get("place_type") or []
    first_type = place_type[0] if place_type else ""
    relevance = _safe_float(feature.get("relevance"))
    if first_type and relevance is not None:
        return f"{first_type}:{relevance:.2f}"
    if first_type:
        return str(first_type)
    if relevance is not None:
        return f"relevance:{relevance:.2f}"
    return ""


def _feature_to_result(query: str, feature: dict[str, Any]) -> dict[str, Any]:
    center = feature.get("center") or []
    lon = _safe_float(center[0]) if len(center) > 0 else None
    lat = _safe_float(center[1]) if len(center) > 1 else None
    return {
        "query": query,
        "mapbox_feature_id": str(feature.get("id", "")),
        "mapbox_place_name": str(feature.get("place_name", "")),
        "geo_mapbox_lon": lon,
        "geo_mapbox_lat": lat,
        "geo_mapbox_relevance": _safe_float(feature.get("relevance")),
        "geo_mapbox_accuracy": _build_accuracy(feature),
        "geo_mapbox_match_status": "matched",
        "geo_mapbox_updated_at": _utc_now(),
    }


def _request_mapbox(
    query: str,
    token: str,
    timeout_seconds: float,
    mapbox_types: str,
    mapbox_country: str,
) -> dict[str, Any]:
    encoded_query = quote(query, safe="")
    url = (
        f"{MAPBOX_ENDPOINT}/{encoded_query}.json"
        f"?access_token={quote(token, safe='')}&limit=1&autocomplete=false&language=en"
        f"&types={quote(mapbox_types, safe=',')}"
    )
    if mapbox_country:
        url += f"&country={quote(mapbox_country, safe=',')}"
    request = Request(url, headers={"User-Agent": "okasmin-geocoder/1.0"})
    with urlopen(request, timeout=timeout_seconds) as response:
        return json.loads(response.read().decode("utf-8"))


def _extract_best_feature(payload: dict[str, Any]) -> dict[str, Any] | None:
    features = payload.get("features") or []
    if not features:
        return None
    return features[0]


def _feature_country_iso2(feature: dict[str, Any]) -> str:
    context = feature.get("context") or []
    for item in context:
        item_id = str(item.get("id", ""))
        if item_id.startswith("country."):
            short_code = str(item.get("short_code", "")).strip().lower()
            if short_code:
                return short_code
    properties = feature.get("properties") or {}
    short_code = str(properties.get("short_code", "")).strip().lower()
    return short_code


def types_for_source(source_cols: str) -> str:
    source = (source_cols or "").strip().lower()
    if source == "country":
        return "country"
    if source == "culture||country":
        return "place,district,region,country"
    if source in {"state", "state||country", "region", "region||country"}:
        return "region,district,country,place"
    if source.startswith("city"):
        return "place,district,region,country"
    if source == "culture":
        return "country,region"
    if source in {"artistnationality", "department||artistnationality"}:
        return "country"
    return DEFAULT_TYPES


def make_source_key(source_cols: str) -> str:
    source = (source_cols or "").strip()
    return source if source else "default"


def is_uncertain_source(source_cols: str, geo_confidence: Any, geo_eligible: Any) -> bool:
    source = (source_cols or "").strip().lower()
    if source in {"artistnationality", "department||artistnationality"}:
        return True

    confidence = _safe_float(geo_confidence)
    eligible = str(geo_eligible).strip().lower() == "true"
    if confidence is not None and confidence < 0.50:
        return True
    if not eligible:
        return True
    return False


def infer_country_iso2(query: str) -> str:
    cleaned = _clean_query(query)
    if not cleaned:
        return ""
    parts = [p.strip().lower() for p in cleaned.split(",") if p.strip()]
    if not parts:
        return ""
    tail = parts[-1].replace(".", "")
    return COUNTRY_TO_ISO2.get(tail, "")


def geocode_query(
    query: str,
    source_key: str,
    mapbox_types: str,
    mapbox_country: str,
    token: str,
    retries: int = DEFAULT_RETRIES,
    backoff_seconds: float = DEFAULT_BACKOFF_SECONDS,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    source_key = source_key or "default"
    mapbox_types = mapbox_types or DEFAULT_TYPES
    mapbox_country = (mapbox_country or "").strip().lower()
    if not query:
        return _empty_result(query, "skipped")

    attempt = 0
    while True:
        try:
            # If source includes country context, anchor country first, then resolve finer place types.
            wants_country_first = "country" in source_key.lower()
            anchored_country = mapbox_country
            if wants_country_first:
                country_payload = _request_mapbox(
                    query=query,
                    token=token,
                    timeout_seconds=timeout_seconds,
                    mapbox_types="country",
                    mapbox_country=mapbox_country,
                )
                country_feature = _extract_best_feature(country_payload)
                if country_feature:
                    inferred = _feature_country_iso2(country_feature)
                    if inferred:
                        anchored_country = inferred

            payload = _request_mapbox(
                query=query,
                token=token,
                timeout_seconds=timeout_seconds,
                mapbox_types=mapbox_types,
                mapbox_country=anchored_country,
            )
            best_feature = _extract_best_feature(payload)
            if not best_feature:
                # Fallback 1: broaden types while keeping country anchor.
                fallback_types = "country,region,district,place"
                if fallback_types != mapbox_types:
                    payload = _request_mapbox(
                        query=query,
                        token=token,
                        timeout_seconds=timeout_seconds,
                        mapbox_types=fallback_types,
                        mapbox_country=anchored_country,
                    )
                    best_feature = _extract_best_feature(payload)
            if not best_feature and anchored_country:
                # Fallback 2: broaden and remove country filter.
                payload = _request_mapbox(
                    query=query,
                    token=token,
                    timeout_seconds=timeout_seconds,
                    mapbox_types="country,region,district,place",
                    mapbox_country="",
                )
                best_feature = _extract_best_feature(payload)
            if not best_feature:
                result = _empty_result(query, "no_match")
                result["source_key"] = source_key
                result["mapbox_types"] = mapbox_types
                result["mapbox_country"] = anchored_country
                return result
            result = _feature_to_result(query, best_feature)
            result["source_key"] = source_key
            result["mapbox_types"] = mapbox_types
            result["mapbox_country"] = anchored_country
            return result
        except HTTPError as err:
            retriable = err.code in {429, 500, 502, 503, 504}
            if attempt >= retries or not retriable:
                result = _empty_result(query, "error")
                result["source_key"] = source_key
                result["mapbox_types"] = mapbox_types
                result["mapbox_country"] = mapbox_country
                return result
        except URLError:
            if attempt >= retries:
                result = _empty_result(query, "error")
                result["source_key"] = source_key
                result["mapbox_types"] = mapbox_types
                result["mapbox_country"] = mapbox_country
                return result

        sleep_seconds = backoff_seconds * (2**attempt) + random.uniform(0.0, 0.25)
        time.sleep(sleep_seconds)
        attempt += 1


def read_cache(cache_csv_path: Path) -> dict[tuple[str, str, str, str], dict[str, Any]]:
    if not cache_csv_path.exists():
        return {}

    cache_df = pd.read_csv(cache_csv_path)
    required_cols = {
        "query",
        "mapbox_feature_id",
        "mapbox_place_name",
        "geo_mapbox_lon",
        "geo_mapbox_lat",
        "geo_mapbox_relevance",
        "geo_mapbox_accuracy",
        "geo_mapbox_match_status",
        "geo_mapbox_updated_at",
    }
    has_legacy_shape = required_cols.issubset(cache_df.columns)
    has_new_shape = has_legacy_shape and {"source_key", "mapbox_types", "mapbox_country"}.issubset(cache_df.columns)
    if not has_legacy_shape:
        return {}

    cache: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    for row in cache_df.to_dict(orient="records"):
        query = _clean_query(row.get("query"))
        if not query:
            continue
        source_key = make_source_key(row.get("source_key", "default") if has_new_shape else "default")
        row["query"] = query
        row["source_key"] = source_key
        row["mapbox_types"] = str(row.get("mapbox_types", DEFAULT_TYPES))
        row["mapbox_country"] = str(row.get("mapbox_country", "")).strip().lower()
        row["geo_mapbox_lon"] = _safe_float(row.get("geo_mapbox_lon"))
        row["geo_mapbox_lat"] = _safe_float(row.get("geo_mapbox_lat"))
        row["geo_mapbox_relevance"] = _safe_float(row.get("geo_mapbox_relevance"))
        cache[(query, source_key, row["mapbox_types"], row["mapbox_country"])] = row
    return cache


def write_cache(cache: dict[tuple[str, str, str, str], dict[str, Any]], cache_csv_path: Path, cache_json_path: Path) -> None:
    cache_csv_path.parent.mkdir(parents=True, exist_ok=True)
    rows = [cache[k] for k in sorted(cache, key=lambda item: (item[0], item[1], item[2], item[3]))]
    cache_df = pd.DataFrame(rows)
    cache_df.to_csv(cache_csv_path, index=False)
    cache_json_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def geocode_fields(
    input_csv_path: Path,
    output_csv_path: Path,
    output_json_path: Path,
    cache_csv_path: Path,
    cache_json_path: Path,
    token: str,
    sleep_between_calls_seconds: float,
) -> dict[str, Any]:
    started_at = time.time()
    df = pd.read_csv(input_csv_path)

    location_col = "geo_normalized_best_guess_location"
    source_col = "geo_normalized_source_cols"
    confidence_col = "geo_normalized_confidence"
    eligible_col = "geo_normalized_geo_eligible"
    if location_col not in df.columns:
        raise ValueError(
            "Input CSV missing required location column: 'geo_normalized_best_guess_location'."
        )

    queries = df[location_col].fillna("").map(_clean_query)
    sources = (
        df[source_col].fillna("").astype(str)
        if source_col in df.columns
        else pd.Series([""] * len(df))
    )
    source_keys = sources.map(make_source_key)
    mapbox_types = sources.map(types_for_source)
    if confidence_col in df.columns and eligible_col in df.columns:
        uncertainty_mask = [
            is_uncertain_source(src, conf, eligible)
            for src, conf, eligible in zip(
                sources,
                df[confidence_col],
                df[eligible_col],
            )
        ]
        mapbox_types = mapbox_types.where(~pd.Series(uncertainty_mask), UNCERTAIN_TYPES)
        strict_artist_mask = source_keys.isin(["artistNationality", "department||artistNationality"])
        mapbox_types = mapbox_types.where(~strict_artist_mask, "country")
        uk_subnational_mask = strict_artist_mask & queries.str.strip().str.lower().isin(UK_SUBNATIONALS)
        mapbox_types = mapbox_types.where(~uk_subnational_mask, "country,region")
    # If culture normalization already produced explicit place-country text, allow place-level capture.
    culture_place_mask = source_keys.str.startswith("culture") & queries.str.contains(",", na=False)
    mapbox_types = mapbox_types.where(~culture_place_mask, "place,district,region,country")
    mapbox_country = queries.map(infer_country_iso2)

    work_df = pd.DataFrame(
        {
            "query": queries,
            "source_key": source_keys,
            "mapbox_types": mapbox_types,
            "mapbox_country": mapbox_country,
        }
    )
    unique_work = (
        work_df[work_df["query"] != ""]
        .drop_duplicates(subset=["query", "source_key", "mapbox_types", "mapbox_country"], keep="first")
        .sort_values(by=["query", "source_key", "mapbox_types", "mapbox_country"], kind="stable")
        .reset_index(drop=True)
    )
    unique_work_items = [
        {
            "query": row["query"],
            "source_key": row["source_key"],
            "mapbox_types": row["mapbox_types"],
            "mapbox_country": row["mapbox_country"],
        }
        for _, row in unique_work.iterrows()
    ]

    cache = read_cache(cache_csv_path)
    misses = [
        item
        for item in unique_work_items
        if (item["query"], item["source_key"], item["mapbox_types"], item["mapbox_country"]) not in cache
    ]

    print(
        f"[geocode] rows={len(df)} unique_queries={len(unique_work_items)} "
        f"cache_hits={len(unique_work_items) - len(misses)} cache_misses={len(misses)}"
    )

    for i, item in enumerate(misses):
        if i == 0 or (i + 1) % PROGRESS_EVERY == 0 or (i + 1) == len(misses):
            print(
                f"[geocode] querying {i + 1}/{len(misses)}: "
                f"{item['query']} (source={item['source_key']}, "
                f"types={item['mapbox_types']}, country={item['mapbox_country'] or '-'})"
            )
        cache[(item["query"], item["source_key"], item["mapbox_types"], item["mapbox_country"])] = geocode_query(
            query=item["query"],
            source_key=item["source_key"],
            mapbox_types=item["mapbox_types"],
            mapbox_country=item["mapbox_country"],
            token=token,
        )
        if i < len(misses) - 1 and sleep_between_calls_seconds > 0:
            time.sleep(sleep_between_calls_seconds)

    write_cache(cache, cache_csv_path, cache_json_path)

    geocode_df = pd.DataFrame(
        [
            cache.get((q, sk, types, country), _empty_result(q, "skipped"))
            for q, sk, types, country in zip(queries, source_keys, mapbox_types, mapbox_country)
        ]
    )
    existing_geo_cols = [
        "mapbox_feature_id",
        "mapbox_place_name",
        "geo_mapbox_lon",
        "geo_mapbox_lat",
        "geo_mapbox_relevance",
        "geo_mapbox_accuracy",
        "geo_mapbox_match_status",
        "geo_mapbox_updated_at",
    ]
    base_df = df.drop(columns=[c for c in existing_geo_cols if c in df.columns], errors="ignore")
    out = pd.concat(
        [
            base_df.reset_index(drop=True),
            geocode_df.drop(columns=["query", "source_key", "mapbox_types"]),
        ],
        axis=1,
    )
    # Defensive guard against duplicate columns from future schema changes.
    out = out.loc[:, ~out.columns.duplicated(keep="last")]
    out = out.sort_values(by="objectId", kind="stable").reset_index(drop=True)

    output_csv_path.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(output_csv_path, index=False)
    output_json_path.write_text(out.to_json(orient="records", force_ascii=False, indent=2), encoding="utf-8")

    status_counts = (
        out["geo_mapbox_match_status"].fillna("error").value_counts().to_dict()
        if "geo_mapbox_match_status" in out.columns
        else {}
    )
    return {
        "rows_total": int(len(out)),
        "unique_queries_total": int(len(unique_work_items)),
        "cache_hits": int(len(unique_work_items) - len(misses)),
        "cache_misses": int(len(misses)),
        "status_counts": status_counts,
        "elapsed_seconds": round(time.time() - started_at, 2),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Geocode normalized location strings via Mapbox.")
    parser.add_argument("--input-csv", type=Path, default=INPUT_CSV_PATH)
    parser.add_argument("--output-csv", type=Path, default=OUTPUT_CSV_PATH)
    parser.add_argument("--output-json", type=Path, default=OUTPUT_JSON_PATH)
    parser.add_argument("--cache-csv", type=Path, default=CACHE_CSV_PATH)
    parser.add_argument("--cache-json", type=Path, default=CACHE_JSON_PATH)
    parser.add_argument("--sleep-seconds", type=float, default=0.05)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    load_env_file(ENV_PATH)
    token = os.environ.get("MAPBOX_TOKEN", "").strip()
    if not token:
        raise RuntimeError("MAPBOX_TOKEN is required in environment or .env.")

    summary = geocode_fields(
        input_csv_path=args.input_csv,
        output_csv_path=args.output_csv,
        output_json_path=args.output_json,
        cache_csv_path=args.cache_csv,
        cache_json_path=args.cache_json,
        token=token,
        sleep_between_calls_seconds=args.sleep_seconds,
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
