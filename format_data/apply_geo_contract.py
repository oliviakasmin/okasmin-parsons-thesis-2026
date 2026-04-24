from __future__ import annotations

import csv
import re
from pathlib import Path


CSV_PATH = Path(__file__).resolve().parent / "fields.csv"

UNCERTAINTY_RE = re.compile(r"\b(or|possibly|probably|vicinity)\b|\?", re.IGNORECASE)
PARENS_RE = re.compile(r"\(([^()]*)\)")

PLACE_LIKE_RE = re.compile(r"^[A-Za-z][A-Za-z\s\-'.,]+$")

DEMONYM_MAP = {
    "german": "Germany",
    "italian": "Italy",
    "british": "Britain",
    "scottish": "Scotland",
    "french": "France",
    "swiss": "Switzerland",
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

CULTURE_MAP = {
    "french (paris)": "Paris, France",
    "cypriot": "Cyprus",
    "cycladic": "Cyclades, Greece",
    "attic": "Attica, Greece",
    "east greek": "East Greece",
    "apulian": "Apulia, Italy",
    "campanian": "Campania, Italy",
    "canosan": "Canosa di Puglia, Italy",
    "etruscan": "Etruria, Italy",
    "etrusco-corinthian": "Etruria, Italy",
    "italo-corinthian": "Etruria, Italy",
}

COUNTRY_HINTS = {
    "china",
    "japan",
    "korea",
    "iran",
    "iraq",
    "syria",
    "egypt",
    "turkey",
    "greece",
    "france",
    "italy",
    "spain",
    "netherlands",
    "united kingdom",
    "britain",
    "switzerland",
    "ghana",
    "mexico",
    "peru",
    "guatemala",
    "vietnam",
    "cyprus",
    "thailand",
    "india",
    "united states",
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


def cleanup_uncertainty_noise(text: str) -> str:
    text = re.sub(r"\b(possibly|probably|vicinity)\b", "", text, flags=re.IGNORECASE)
    text = text.replace("?", " ")
    text = text.replace("(?)", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip(" ,;")


def extract_candidate(text: str) -> tuple[str, bool]:
    text = clean(text)
    if not text:
        return "", False

    ambiguous = bool(UNCERTAINTY_RE.search(text))
    if re.search(r"\bor\b", text, flags=re.IGNORECASE):
        text = re.split(r"\bor\b", text, flags=re.IGNORECASE)[0].strip(" ,;")
        ambiguous = True

    text = cleanup_uncertainty_noise(text)
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


def normalize_culture(value: str) -> tuple[str, bool]:
    value, ambiguous = extract_candidate(value)
    if not value:
        return "", ambiguous

    lowered = value.lower()
    if lowered in CULTURE_MAP:
        return CULTURE_MAP[lowered], ambiguous

    # Pattern: "Country (Specific Place)" or "Demonym (City)"
    paren_match = PARENS_RE.search(value)
    if paren_match:
        inner = cleanup_uncertainty_noise(paren_match.group(1))
        outer = cleanup_uncertainty_noise(PARENS_RE.sub("", value))
        outer_country = DEMONYM_MAP.get(outer.lower(), outer)

        if inner and PLACE_LIKE_RE.match(inner) and outer_country and PLACE_LIKE_RE.match(outer_country):
            if inner.lower().endswith("culture"):
                # e.g. Thailand (Ban Chiang culture) -> Thailand
                return outer_country, ambiguous
            # e.g. French (Paris) -> Paris, France
            return f"{inner}, {outer_country}", ambiguous

    demonym = DEMONYM_MAP.get(value.lower())
    if demonym:
        return demonym, ambiguous

    # Keep only likely geocoder-friendly place-like strings.
    if PLACE_LIKE_RE.match(value):
        return value, ambiguous
    return "", True


def canonicalize_location(location: str) -> str:
    location = cleanup_uncertainty_noise(location)
    location = re.sub(r"\(\s*\)", "", location).strip(" ,;")
    location = re.sub(r"\s+", " ", location)
    return location


def department_bias_for_nationality(department: str, location: str) -> float:
    dept = (department or "").lower()
    loc = location.lower()
    if not loc:
        return 0.0

    if "european" in dept and loc in {
        "italy",
        "germany",
        "france",
        "spain",
        "united kingdom",
        "britain",
        "netherlands",
        "greece",
        "switzerland",
    }:
        return 0.08
    if "asian" in dept and loc in {"japan", "china", "korea", "india"}:
        return 0.08
    if "islamic" in dept and loc in {"iran", "iraq", "syria", "egypt", "turkey"}:
        return 0.08
    # weakly conflicting department context
    if any(k in dept for k in ("european", "asian", "islamic")):
        return -0.10
    return 0.0


def is_mappable_place(location: str) -> bool:
    loc = location.lower()
    if not loc:
        return False
    if "," in location:
        return True
    if loc in COUNTRY_HINTS:
        return True
    return any(loc.endswith(f" {country}") for country in COUNTRY_HINTS)


def resolve_location(department: str, geo_options: str) -> tuple[str, str, float, bool]:
    city, state, region, country, culture_raw, artist_nationality = parse_geo_options(geo_options)
    city, city_amb = extract_candidate(city)
    state, state_amb = extract_candidate(state)
    region, region_amb = extract_candidate(region)
    country, country_amb = extract_candidate(country)
    culture, culture_amb = normalize_culture(culture_raw)
    nationality_place, nationality_amb = normalize_nationality(artist_nationality)

    if (department or "").strip().lower() == "greek and roman art" and clean(culture_raw).lower() == "roman":
        return "", "none", 0.0, False

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

        dept_adjust = department_bias_for_nationality(department, location)
        if dept_adjust != 0.0:
            source = "department||artistNationality"
            confidence += dept_adjust
    else:
        return "", "none", 0.0, False

    location = canonicalize_location(location)
    # Contract guardrail: if culture/nationality path could not produce a mappable place, return null output.
    if source in {"culture", "artistNationality", "department||artistNationality"} and not is_mappable_place(location):
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
