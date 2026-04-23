from __future__ import annotations

import csv
import re
from pathlib import Path


CSV_PATH = Path(__file__).resolve().parent / "fields.csv"

UNCERTAINTY_RE = re.compile(r"\b(or|possibly|probably|vicinity)\b|\?", re.IGNORECASE)

DEMONYM_MAP = {
    "german": "Germany",
    "italian": "Italy",
    "british": "United Kingdom",
    "scottish": "United Kingdom",
    "french": "France",
    "spanish": "Spain",
    "dutch": "Netherlands",
    "chinese": "China",
    "japanese": "Japan",
    "korean": "Korea",
    "iranian": "Iran",
    "iraqi": "Iraq",
    "syrian": "Syria",
    "egyptian": "Egypt",
    "turkish": "Turkey",
    "greek": "Greece",
    "american": "United States",
    "mexican": "Mexico",
    "peruvian": "Peru",
    "indian": "India",
}


def clean(value: str | None) -> str:
    if value is None:
        return ""
    value = value.strip()
    if not value or value.lower() == "undefined":
        return ""
    return value


def parse_geo_options(raw: str) -> list[str]:
    parts = raw.split("||") if raw is not None else []
    if len(parts) < 6:
        parts += [""] * (6 - len(parts))
    elif len(parts) > 6:
        parts = parts[:5] + ["||".join(parts[5:])]
    return [clean(p) for p in parts]


def extract_candidate(text: str) -> tuple[str, bool]:
    text = clean(text)
    if not text:
        return "", False

    lower = text.lower()
    ambiguous = bool(UNCERTAINTY_RE.search(lower))
    if " or " in lower:
        text = text.split(" or ")[0].strip(" ,;")
        ambiguous = True

    text = re.sub(r"\b(possibly|probably|vicinity)\b", "", text, flags=re.IGNORECASE)
    text = text.replace("?", " ").strip(" ,;")
    text = re.sub(r"\s+", " ", text)
    return text, ambiguous


def normalize_nationality(value: str) -> tuple[str, bool]:
    value, ambiguous = extract_candidate(value)
    if not value:
        return "", ambiguous

    tokens = re.split(r"[,/;]|\band\b", value, flags=re.IGNORECASE)
    mapped: list[str] = []
    for token in tokens:
        token = token.strip()
        if not token:
            continue
        mapped.append(DEMONYM_MAP.get(token.lower(), token))

    unique: list[str] = []
    seen: set[str] = set()
    for candidate in mapped:
        key = candidate.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(candidate)

    if not unique:
        return "", ambiguous
    return unique[0], ambiguous or len(unique) > 1


def resolve_location(department: str, geo_options: str) -> tuple[str, str, float, bool]:
    city, state, region, country, culture, artist_nationality = parse_geo_options(geo_options)
    city, city_amb = extract_candidate(city)
    state, state_amb = extract_candidate(state)
    region, region_amb = extract_candidate(region)
    country, country_amb = extract_candidate(country)
    culture, culture_amb = extract_candidate(culture)
    nationality_place, nationality_amb = normalize_nationality(artist_nationality)

    if city:
        if state and country:
            location, source, confidence, ambiguous = (
                f"{city}, {state}, {country}",
                "city||state||country",
                0.95,
                city_amb or state_amb or country_amb,
            )
        elif state:
            location, source, confidence, ambiguous = (
                f"{city}, {state}",
                "city||state",
                0.85,
                city_amb or state_amb,
            )
        elif country:
            location, source, confidence, ambiguous = (
                f"{city}, {country}",
                "city||country",
                0.88,
                city_amb or country_amb,
            )
        elif region:
            location, source, confidence, ambiguous = (
                f"{city}, {region}",
                "city||region",
                0.45,
                city_amb or region_amb,
            )
        elif culture:
            location, source, confidence, ambiguous = (
                f"{city}, {culture}",
                "city||culture",
                0.65,
                city_amb or culture_amb,
            )
        else:
            location, source, confidence, ambiguous = city, "city", 0.35, city_amb
    elif state:
        if country:
            location, source, confidence, ambiguous = (
                f"{state}, {country}",
                "state||country",
                0.72,
                state_amb or country_amb,
            )
        elif culture:
            location, source, confidence, ambiguous = (
                f"{state}, {culture}",
                "state||culture",
                0.58,
                state_amb or culture_amb,
            )
        else:
            location, source, confidence, ambiguous = state, "state", 0.35, state_amb
    elif region:
        if country:
            location, source, confidence, ambiguous = (
                f"{region}, {country}",
                "region||country",
                0.70,
                region_amb or country_amb,
            )
        elif culture:
            location, source, confidence, ambiguous = (
                f"{region}, {culture}",
                "region||culture",
                0.58,
                region_amb or culture_amb,
            )
        else:
            location, source, confidence, ambiguous = region, "region", 0.35, region_amb
    elif country:
        location, source, confidence, ambiguous = country, "country", 0.70, country_amb
    elif culture:
        location, source, confidence, ambiguous = culture, "culture", 0.55, culture_amb
    elif nationality_place:
        location = nationality_place
        source = "artistNationality"
        confidence = 0.45
        ambiguous = nationality_amb

        dept = (department or "").lower()
        if "european" in dept and location in {
            "Italy",
            "Germany",
            "France",
            "Spain",
            "United Kingdom",
            "Netherlands",
            "Greece",
        }:
            source = "department||artistNationality"
            confidence += 0.08
        elif "asian" in dept and location in {"Japan", "China", "Korea", "India", "Iran"}:
            source = "department||artistNationality"
            confidence += 0.08
        elif "islamic" in dept and location in {"Iran", "Iraq", "Syria", "Egypt", "Turkey"}:
            source = "department||artistNationality"
            confidence += 0.08
    else:
        return "", "none", 0.0, False

    if ambiguous:
        confidence -= 0.20
    confidence = max(0.0, min(1.0, confidence))
    return location, source, round(confidence, 2), confidence >= 0.30


def main() -> None:
    with CSV_PATH.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = list(reader.fieldnames or [])

    new_columns = [
        "geo_LLM_best_guess_location_normalized",
        "geo_LLM_source_cols",
        "geo_LLM_confidence",
        "geo_LLM_geo_eligible",
    ]
    for col in new_columns:
        if col not in fieldnames:
            fieldnames.append(col)

    for row in rows:
        location, source, confidence, eligible = resolve_location(
            row.get("department", ""), row.get("geo_options", "")
        )
        row["geo_LLM_best_guess_location_normalized"] = location
        row["geo_LLM_source_cols"] = source
        row["geo_LLM_confidence"] = f"{confidence:.2f}"
        row["geo_LLM_geo_eligible"] = "true" if eligible else "false"

    with CSV_PATH.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Updated {len(rows)} rows in {CSV_PATH}")


if __name__ == "__main__":
    main()
