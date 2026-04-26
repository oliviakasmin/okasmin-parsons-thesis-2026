from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Any

from .function_group_mapping import FUNCTION_GROUP_STRINGS, ORDER_OF_PRIORITY, group_mappings

# RUN FROM REPO ROOT:
# python -m format_data.get_object_function_group


ROOT = Path(__file__).resolve().parents[1]
OBJECTS_PATH = ROOT / "fetch_data" / "data" / "objects.json"
OUTPUT_PATH = ROOT / "format_data" / "object_function_groups.csv"

def _clean(value: str | None) -> str:
    return (value or "").strip()


def _normalize(value: str | None) -> str:
    return _clean(value).casefold()


def _group_label(group_value: list[str]) -> str:
    # group mapping values are lists like ["jar"]; use the first token.
    return group_value[0]


def _build_group_keyword_to_group() -> dict[str, str]:
    keyword_to_group: dict[str, str] = {}
    for group_arr in FUNCTION_GROUP_STRINGS:
        if not group_arr:
            continue
        label = _group_label(group_arr)
        for keyword in group_arr:
            keyword_to_group[_normalize(keyword)] = label
    return keyword_to_group


GROUP_KEYWORD_TO_GROUP = _build_group_keyword_to_group()
OBJECTNAME_MAP = {_normalize(key): _group_label(value) for key, value in group_mappings.items()}
GROUP_PRIORITY = {_group_label(group): idx for idx, group in enumerate(ORDER_OF_PRIORITY)}


def _contains_word(text: str, token: str) -> bool:
    return bool(re.search(rf"\b{re.escape(token)}\b", text))


def _resolve_candidate_groups(text: str) -> list[str]:
    """
    Shared mapping resolver used for both objectName and title.

    Priority behavior:
    - "storage" (word-boundary) trumps all groups
    - "bottle vase" (word-boundary phrase) maps to "vase" and is prioritized
    - then explicit objectName mappings
    - then generic group keywords
    """
    text_norm = _normalize(text)
    if not text_norm:
        return []

    hits: list[str] = []

    if _contains_word(text_norm, "storage"):
        hits.append("storage")
    if _contains_word(text_norm, "bottle vase"):
        hits.append("vase")

    for object_name_key, group in OBJECTNAME_MAP.items():
        if _contains_word(text_norm, object_name_key):
            hits.append(group)

    for keyword, group in GROUP_KEYWORD_TO_GROUP.items():
        if _contains_word(text_norm, keyword):
            hits.append(group)

    out: list[str] = []
    seen: set[str] = set()
    for group in hits:
        if group in seen:
            continue
        seen.add(group)
        out.append(group)

    # Final enforcement of special-case precedence.
    if "storage" in out:
        out = ["storage"] + [g for g in out if g != "storage"]
    elif "vase" in out and _contains_word(text_norm, "bottle vase"):
        out = ["vase"] + [g for g in out if g != "vase"]
    return out


def _primary_group(text: str) -> str:
    groups = _resolve_candidate_groups(text)
    if not groups:
        return ""
    return groups[0]


def _normalize_group_value(group: str | None) -> str:
    group_clean = _normalize(group)
    if group_clean in {"", "nan", "none", "null"}:
        return ""
    return group_clean


def _higher_priority_group(group_a: str, group_b: str) -> str:
    """
    Return the higher-priority group according to ORDER_OF_PRIORITY.
    Lower index == higher priority.
    """
    rank_a = GROUP_PRIORITY.get(group_a)
    rank_b = GROUP_PRIORITY.get(group_b)
    if rank_a is None and rank_b is None:
        return ""
    if rank_a is None:
        return group_b
    if rank_b is None:
        return group_a
    return group_a if rank_a <= rank_b else group_b


def resolve_final_group(object_name: str, title: str) -> str:
    """Resolve final group from objectName/title using priority rules."""
    object_group = _normalize_group_value(_primary_group(object_name))
    title_group = _normalize_group_value(_primary_group(title))

    # Same, non-empty
    if object_group and title_group and object_group == title_group:
        return object_group

    # One side empty
    if object_group and not title_group:
        return object_group
    if title_group and not object_group:
        return title_group

    # Both empty
    if not object_group and not title_group:
        return "None"

    # Both present but differ: resolve by ORDER_OF_PRIORITY
    chosen = _higher_priority_group(object_group, title_group)
    return chosen if chosen else "None"


def map_function_group(object_name: str, title: str) -> str:
    """
    Backward-compatible wrapper for final group resolution.
    """
    object_name_norm = _normalize(object_name)

    # Hard overrides: these objectName forms should never emit alternates.
    if _contains_word(object_name_norm, "storage jar"):
        return "storage"
    if _contains_word(object_name_norm, "bottle vase"):
        return "vase"
    return resolve_final_group(object_name, title)


def load_objects(path: Path = OBJECTS_PATH) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError(f"Expected dict-like objects.json at {path}")
    return data


def build_rows(objects_by_id: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for object_id, obj in objects_by_id.items():
        object_name = _clean(obj.get("objectName"))
        title = _clean(obj.get("title"))
        department = _clean(obj.get("department"))
        final_group = map_function_group(object_name, title)
        rows.append(
            {
                "objectID": object_id,
                "department": department,
                "objectName": object_name,
                "title": title,
                "final_group": final_group,
            }
        )
    return rows


def save_rows(rows: list[dict[str, Any]], path: Path = OUTPUT_PATH) -> None:
    if not rows:
        return
    fieldnames = list(rows[0].keys())
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    objects_by_id = load_objects()
    rows = build_rows(objects_by_id)
    save_rows(rows)
    print(f"Saved {len(rows)} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()