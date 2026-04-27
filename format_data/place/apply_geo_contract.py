from __future__ import annotations

import re
from pathlib import Path
import pandas as pd


CSV_PATH = Path(__file__).resolve().parents[1] / "generated" / "fields.csv"

UNCERTAINTY_RE = re.compile(r"\b(or|possibly|probably|vicinity)\b|\?", re.IGNORECASE)
PARENS_RE = re.compile(r"\(([^()]*)\)")

PLACE_LIKE_RE = re.compile(r"^[A-Za-z][A-Za-z\s\-'.,]+$")

DEMONYM_MAP = {
    "german": "Germany",
    "italian": "Italy",
    "british": "Britain",
    "british, scottish": "Scotland",
    "scottish": "Scotland",
    "french": "France",
    "swiss": "Switzerland",
    "spanish": "Spain",
    "dutch": "Netherlands",
    "netherlandish": "Netherlands",
    "south netherlandish": "Belgium",
    "belgian": "Belgium",
    "bohemian": "Czech Republic",
    "danish": "Denmark",
    "russian": "Russia",
    "irish": "Ireland",
    "chinese": "China",
    "chinese, for american market": "China",
    "japanese": "Japan",
    "vietnamese": "Vietnam",
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
    "french (limoges)": "Limoges, France",
    "saintonge": "Saintonge, France",
    "scottish": "Scotland",
    "cypriot": "Cyprus",
    "greek, cypriot": "Cyprus",
    "cycladic": "Cyclades, Greece",
    "attic": "Attica, Greece",
    "east greek": "East Greece",
    "greek, attic": "Attica, Greece",
    "greek, corinthian": "Greece",
    "greek, south italian, apulian": "Apulia, Italy",
    "greek, south italian, campanian": "Campania, Italy",
    "greek, south italian, apulian, canosan": "Apulia, Italy",
    "greek, south italian, lucanian": "Basilicata, Italy",
    "greek, south italian, gnathian": "Apulia, Italy",
    "greek, egypt, alexandria-hadra": "Alexandria, Egypt",
    "greek, asia minor": "Turkey",
    "greek, laconian": "Laconia, Greece",
    "east greek, rhodian": "Rhodes, Greece",
    "apulian": "Apulia, Italy",
    "campanian": "Campania, Italy",
    "canosan": "Canosa di Puglia, Italy",
    "etruscan": "Umbria, Italy",
    "etruscan, etrusco-corinthian": "Umbria, Italy",
    "etrusco-corinthian": "Umbria, Italy",
    "italo-corinthian": "Umbria, Italy",
    "faliscan": "Italy",
    "mycenaean": "Greece",
    "helladic": "Greece",
    "helladic, mycenaean": "Greece",
    "minoan": "Crete, Greece",
    "phoenician": "Lebanon",
    "lydian": "Western Turkey",
    "visigothic": "Spain",
    "greek": "Greece",
    "european": "Europe",
    "greek, chalcidian": "Greece",
    "greek, ptolemaic": "Egypt",
    "greek, ptolemaic, cretan": "Crete, Greece",
    "greek, sicilian, centuripe": "Centuripe, Sicily, Italy",
    "greek, probably corinthian": "Greece",
    "greek, probably cypriot": "Cyprus",
    "greek, boeotian (or attic)": "Greece",
    "greek or roman": "Mediterranean",
    "canosan, puglia": "Apulia, Italy",
    "cycladic or cretan": "Greece",
    "mycenaean or cypro-mycenaean": "Greece",
    "maya": "Guatemala",
    "olmec": "Mexico",
    "zapotec": "Oaxaca, Mexico",
    "mixtec": "Oaxaca, Mexico",
    "mexica (aztec)": "Central Mexico",
    "chupicuaro": "Central Mexico",
    "casas grandes": "Chihuahua, Mexico",
    "monte alban": "Oaxaca, Mexico",
    "huastec": "Veracruz, Mexico",
    "moche": "Peru",
    "nasca": "Peru",
    "paracas": "Peru",
    "topara": "Peru",
    "cupisnique": "Peru",
    "chimu": "Peru",
    "inca": "Peru",
    "vicus": "Peru",
    "wari": "Peru",
    "salinar (?)": "Peru",
    "recuay": "Peru",
    "chorrera": "Ecuador",
    "quimbaya": "Colombia",
    "coptic": "Egypt",
    "dogon peoples": "Mali",
    "tellem peoples": "Mali",
    "middle niger civilization": "Mali",
    "chinese": "China",
    "japanese": "Japan",
    "roman": "Mediterranean",
    "east greek, rhodian": "Rhodes, Greece",
    "east greek, rhodian (?)": "Rhodes, Greece",
}

LOCATION_CLEANUP_MAP = {
    "probably rayy": "Rayy, Iran",
    "probably isfahan": "Isfahan, Iran",
    "probably mashhad": "Mashhad, Iran",
    "probably kirman": "Kerman, Iran",
    "probably basra": "Basra, Iraq",
    "near susa": "Susa, Iran",
    "near raqqa": "Raqqa, Syria",
    "nishapur or samarqand": "Nishapur, Iran",
    "iran or iraq": "Iran",
    "iraq or syria": "Iraq",
    "iran or present-day uzbekistan": "Iran",
    "iraq or iran, persian gulf": "Iraq",
    "italian, castelli": "Castelli, Italy",
    "italian, deruta": "Deruta, Italy",
    "italian, urbino": "Urbino, Italy",
    "italian, faenza": "Faenza, Italy",
    "italian, naples": "Naples, Italy",
    "italian, gubbio": "Gubbio, Italy",
    "italian, florence": "Florence, Italy",
    "italian, florence or vicinity": "Florence, Italy",
    "italian, probably florence or vicinity": "Florence, Italy",
    "italian, possibly florence or faenza": "Florence, Italy",
    "italian (supposedly faenza or florence)": "Faenza, Italy",
    "italian, faenza or florence": "Faenza, Italy",
    "italian, faenza or pesaro": "Faenza, Italy",
    "italian, faenza or naples": "Faenza, Italy",
    "italian, probably faenza": "Faenza, Italy",
    "italian, probably faenza (or palermo)": "Faenza, Italy",
    "italian, probably gubbio": "Gubbio, Italy",
    "italian (probably naples)": "Naples, Italy",
    "italian, perhaps trapani": "Trapani, Italy",
    "italian, tuscany, cafaggiolo or montelupo": "Montelupo, Tuscany, Italy",
    "italian, probably tuscany (?)": "Tuscany, Italy",
    "probably manises": "Manises, Valencia, Spain",
    "manises": "Manises, Valencia, Spain",
    "paterna": "Paterna, Valencia, Spain",
    "probably seville": "Seville, Spain",
    "spain or north africa": "Spain",
    "paris or its vicinity": "Paris, France",
    "china (?)": "China",
    "greek, boeotian (or attic)": "Greece",
    "probably surrey": "Surrey, England",
    "potter toynton (?)": "Toynton, Lincolnshire, England",
    "west midlands": "West Midlands, England",
    "wiltshire": "Wiltshire, England",
    "derbyshire": "Derbyshire, England",
    "surrey": "Surrey, England",
    "siegburg": "Siegburg, Germany",
    "middle rhineland (?)": "Rhineland, Germany",
    "meuse valley": "Meuse Valley, Netherlands",
    "delft": "Delft, Netherlands",
    "central andes": "Central Andes, Peru",
    "ica valley": "Ica Valley, Peru",
    "ica river, south coast": "Ica Valley, Peru",
    "santa province": "Santa Province, Peru",
    "santa province (?)": "Santa Province, Peru",
    "chicama valley": "Chicama Valley, Peru",
    "tembladera": "Tembladera, Peru",
    "ancash": "Ancash, Peru",
    "piura": "Piura, Peru",
    "west mexico": "Western Mexico",
    "colima": "Colima, Mexico",
    "veracruz": "Veracruz, Mexico",
    "oaxaca": "Oaxaca, Mexico",
    "puebla": "Puebla, Mexico",
    "nayarit": "Nayarit, Mexico",
    "michoacan": "Michoacan, Mexico",
    "chihuahua": "Chihuahua, Mexico",
    "mid-atlantic united states": "Mid-Atlantic, United States",
    "new england united states": "New England, United States",
    "midwest united states": "Midwest, United States",
    "southern": "Southern United States",
    "upper egypt, thebes": "Thebes, Egypt",
    "northern upper egypt": "Upper Egypt, Egypt",
    "southern upper egypt": "Upper Egypt, Egypt",
    "middle egypt": "Middle Egypt, Egypt",
    "memphite region": "Memphis region, Egypt",
    "thebes, byzantine egypt": "Thebes, Egypt",
    "probably egypt": "Egypt",
    "vietnam, hong river region": "Red River Delta, Vietnam",
    "thailand (si satchanalai)": "Si Satchanalai, Thailand",
    "thailand (ban chiang)": "Ban Chiang, Thailand",
    "thailand (buriram province)": "Buriram Province, Thailand",
    "thailand (ban chiang culture)": "Ban Chiang, Thailand",
    "cocle province": "Cocle Province, Panama",
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
    "germany",
    "italy",
    "spain",
    "netherlands",
    "united kingdom",
    "britain",
    "scotland",
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
    "lebanon",
    "england",
    "mali",
    "ecuador",
    "colombia",
    "panama",
    "belgium",
    "czech republic",
    "denmark",
    "russia",
    "ireland",
    "levant",
    "europe",
    "mediterranean",
    "eastern mediterranean",
    "western turkey",
    "central mexico",
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
    raw_key = text.lower()
    if raw_key in LOCATION_CLEANUP_MAP:
        return LOCATION_CLEANUP_MAP[raw_key], True if ambiguous else False

    if re.search(r"\bor\b", text, flags=re.IGNORECASE):
        text = re.split(r"\bor\b", text, flags=re.IGNORECASE)[0].strip(" ,;")
        ambiguous = True

    text = cleanup_uncertainty_noise(text)
    cleaned_key = text.lower()
    if cleaned_key in LOCATION_CLEANUP_MAP:
        return LOCATION_CLEANUP_MAP[cleaned_key], True if ambiguous else False
    return text, ambiguous


def normalize_nationality(value: str) -> tuple[str, bool]:
    value, ambiguous = extract_candidate(value)
    if not value:
        return "", ambiguous

    direct = DEMONYM_MAP.get(value.lower())
    if direct:
        return direct, ambiguous

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

    # Only collapse broad Peruvian coastal labels to Peru when country context is explicitly Peru.
    culture_raw_key = clean(culture_raw).lower()
    coast_labels = {"north coast", "south coast"}
    if country.lower() == "peru":
        if city.lower() in coast_labels:
            city = ""
        if state.lower() in coast_labels:
            state = ""
        if region.lower() in coast_labels:
            region = ""
    if culture_raw_key in {"north coast", "south coast"}:
        if country.lower() == "peru":
            culture = "Peru"
        else:
            culture = ""

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
        # If culture normalization yields a specific place and country, keep provenance explicit.
        culture_source = "culture||country" if "," in culture else "culture"
        location, source, confidence, ambiguous = culture, culture_source, 0.55, culture_amb
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


def apply_geo_contract_df(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["department"] = out["department"].fillna("")
    out["geo_options"] = out["geo_options"].fillna("")

    resolved = out.apply(
        lambda row: resolve_location(row["department"], row["geo_options"]),
        axis=1,
        result_type="expand",
    )
    resolved.columns = [
        "geo_normalized_best_guess_location",
        "geo_normalized_source_cols",
        "geo_normalized_confidence",
        "geo_normalized_geo_eligible",
    ]

    out["geo_normalized_best_guess_location"] = resolved[
        "geo_normalized_best_guess_location"
    ]
    out["geo_normalized_source_cols"] = resolved["geo_normalized_source_cols"]
    out["geo_normalized_confidence"] = resolved["geo_normalized_confidence"].map(lambda v: f"{v:.2f}")
    out["geo_normalized_geo_eligible"] = resolved["geo_normalized_geo_eligible"].map(
        lambda v: "true" if v else "false"
    )
    return out


def main() -> None:
    df = pd.read_csv(CSV_PATH)
    out = apply_geo_contract_df(df)
    out.to_csv(CSV_PATH, index=False)

    print(f"Updated {len(out)} rows in {CSV_PATH}")


if __name__ == "__main__":
    main()