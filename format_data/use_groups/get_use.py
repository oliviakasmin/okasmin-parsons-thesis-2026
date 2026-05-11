# Run from repo root:
#   python format_data/use_groups/get_use.py

from __future__ import annotations

import csv
import importlib.util
import re
import unicodedata
from pathlib import Path

_DIR = Path(__file__).resolve().parent
_MAPPING_PATH = _DIR / "use_mapping.py"
_ALL_ANIMALS_PATH = _DIR / "all_animals.py"
TITLE_COLS_PATH = _DIR / "title_cols.csv"

_animal_tokens_for_form_of_cache: frozenset[str] | None = None

# Label when no mapping keyword matches.
FALLBACK_USE = "other"

# Per-objectID use labels (Met titles alone are ambiguous). Keys are numeric strings.
OBJECT_USE_OVERRIDES: dict[str, str] = {
    "197485": "animal_shaped",
}


def _object_id_override_key(raw: object) -> str | None:
    if raw is None:
        return None
    if isinstance(raw, str) and not raw.strip():
        return None
    try:
        f = float(raw)
        if f != f:  # NaN
            return None
        return str(int(f))
    except (TypeError, ValueError):
        s = str(raw).strip()
        return s or None

# Category priority: same top-to-bottom order as assignments in use_mapping.py.
# First matching category wins (e.g. ANIMAL_SHAPED before VASE when both match).
USE_GROUP_ORDER = [
    "ANIMAL_SHAPED",
    "RITUAL",
    "POURING",
    "FLASK_AND_BOTTLE",
    "STORAGE",
    "VASE",
]


def _load_mapping_module():
    spec = importlib.util.spec_from_file_location("use_mapping", _MAPPING_PATH)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def _animal_tokens_for_form_of() -> frozenset[str]:
    """Lowercase tokens from ``all_animals.py`` for animal-shaped phrase matching."""
    global _animal_tokens_for_form_of_cache
    if _animal_tokens_for_form_of_cache is not None:
        return _animal_tokens_for_form_of_cache

    spec = importlib.util.spec_from_file_location("use_groups_all_animals", _ALL_ANIMALS_PATH)
    amod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(amod)
    broad = getattr(amod, "BROAD_ZOOLOGICAL_DESCRIPTORS", ())
    literal = getattr(amod, "LITERAL_SPECIES", ())
    _animal_tokens_for_form_of_cache = frozenset(w.strip().lower() for w in (*broad, *literal) if w.strip())
    return _animal_tokens_for_form_of_cache


def _ascii_fold_lower(text: str) -> str:
    """Strip accents for matching catalog French like ``tête d'éléphant``."""
    return (
        unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()
    )


def _title_has_any_animal_token(title_lower: str, tokens: frozenset[str]) -> bool:
    for token in tokens:
        if re.search(rf"\b{re.escape(token)}\b", title_lower):
            return True
    return False


def _matches_animal_shaped(title_lower: str, mod) -> bool:
    for needle in mod.ANIMAL_SHAPED:
        if needle.lower() in title_lower:
            return True

    tokens = _animal_tokens_for_form_of()

    # Strong vessel-shape cues without naming a species (titles use these verbatim).
    if "zoomorphic" in title_lower:
        return True
    if "animal mask" in title_lower or "animal masks" in title_lower:
        return True

    # Anthropomorphic / effigy + named fauna from ``all_animals``.
    if "anthropomorphic" in title_lower and _title_has_any_animal_token(title_lower, tokens):
        return True
    if re.search(r"\beffigy\b", title_lower) and _title_has_any_animal_token(title_lower, tokens):
        return True

    title_fold = _ascii_fold_lower(title_lower)

    for token in tokens:
        esc = re.escape(token)

        phrase_res = (
            rf"\bin the form of a {esc}\b",
            rf"\bin the form of an {esc}\b",
            rf"\bin the shape of a {esc}\b",
            rf"\bin the shape of an {esc}\b",
            # Missing ``the`` (common in Met titles): ``Vase in form of a Carp``.
            rf"\bin form of a {esc}\b",
            rf"\bin form of an {esc}\b",
            rf"\bin shape of a {esc}\b",
            rf"\bin shape of an {esc}\b",
        )
        if any(re.search(p, title_lower) for p in phrase_res):
            return True

        shaped_res = (
            rf"\bshaped like a {esc}\b",
            rf"\bshaped like an {esc}\b",
            rf"\bshaped like {esc}\b",
        )
        if any(re.search(p, title_lower) for p in shaped_res):
            return True

        if (
            re.search(rf"\b{esc}-shaped\b", title_lower)
            or re.search(rf"\b{esc}-headed\b", title_lower)
            or re.search(rf"\b{esc}-head\b", title_lower)
        ):
            return True

        if re.search(rf"\bwith {esc} head\b", title_lower):
            return True
        if re.search(rf"\bwith {esc}-head\b", title_lower):
            return True
        if re.search(rf"\bwith {esc} heads\b", title_lower):
            return True
        if re.search(rf"\bwith {esc}-heads\b", title_lower):
            return True

        # e.g. ``figure with llama headdress``
        if re.search(rf"\b{esc} headdress\b", title_lower):
            return True

        # e.g. ``bird form vessel`` — boundaries avoid ``bear former``
        if re.search(rf"\b{esc} form\b", title_lower):
            return True

        # French: ``vase à tête d'éléphant`` → folded ``tete d'elephant``
        if re.search(rf"\btete d[''`]?{esc}\b", title_fold):
            return True

    return False


def _use_label(const_name: str) -> str:
    return const_name.lower()


def classify_title(title: str, mod) -> str:
    t = title.lower()
    for group in USE_GROUP_ORDER:
        if group == "ANIMAL_SHAPED":
            if _matches_animal_shaped(t, mod):
                return _use_label(group)
            continue
        for needle in getattr(mod, group):
            if needle.lower() in t:
                return _use_label(group)
    return FALLBACK_USE


def resolve_use(object_id: object, title: str, mod) -> str:
    key = _object_id_override_key(object_id)
    if key is not None and key in OBJECT_USE_OVERRIDES:
        return OBJECT_USE_OVERRIDES[key]
    return classify_title(title, mod)


def main() -> None:
    mod = _load_mapping_module()

    with TITLE_COLS_PATH.open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    if not rows:
        raise SystemExit("title_cols.csv has no data rows")

    fieldnames = list(rows[0].keys())
    if "use" not in fieldnames:
        fieldnames.append("use")

    for row in rows:
        title = row.get("title") or ""
        row["use"] = resolve_use(row.get("objectID"), title, mod)

    with TITLE_COLS_PATH.open("w", encoding="utf-8", newline="") as out:
        w = csv.DictWriter(out, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


if __name__ == "__main__":
    main()
