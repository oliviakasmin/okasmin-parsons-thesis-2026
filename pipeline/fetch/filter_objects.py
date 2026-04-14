from typing import Any, Dict

# reject reasons
# - isPublicDomain: reject if not true
# - primaryImageSmall: reject if not true
# - classification: reject if doesn't include "Ceramics"
# - objectName or title includes plural version of search q, ie "vases", "vessels", "pots", "jugs"
# - objectName or title includes ["shard", "plate", "bowl", "cup", "set of"]

CLASSIFICATION_REQUIRED_SUBSTRING = "Ceramics"

# Keep this list explicit so fetch-query tuning does not silently alter filter behavior.
# We still reject pluralized vessel/object words in objectName/title.
PLURAL_TERMS = [
    "vases",
    "bottles",
    "jars",
    "jugs",
    "ewers",
    "urns",
    "flasks",
    "pitchers",
    "vessels",
    "pots",
    "teapots",
    "tea pots",
    # Irregular plural
    "amphorae",
]

# Additional exclusion terms that should cause rejection
EXCLUDED_TERMS = [
    "shard",
    "plate",
    "bowl",
    "cup",
    "set of",
    "service",
    "a pair",
    "a set",
    "tea pot",
    "teapot",
    "dish",
    "fragment",
    "box",
]


def _contains_any_term(text: str, terms: list[str]) -> bool:
    lowered = text.lower()
    return any(term in lowered for term in terms)


def apply_filters(obj: Dict[str, Any], object_id: int, rejected_ids: list[int]) -> bool:
    """
    Apply all rejection rules to an object.

    - Returns True if the object should be kept (included in objects.json).
    - Returns False if it should be rejected, and appends object_id to rejected_ids.
    """
    # isPublicDomain must be true
    if not obj.get("isPublicDomain", False):
        rejected_ids.append(object_id)
        return False

    # primaryImageSmall must be present / non-empty
    if not obj.get("primaryImageSmall"):
        rejected_ids.append(object_id)
        return False

    # classification must include "Ceramics"
    classification = obj.get("classification") or ""
    if CLASSIFICATION_REQUIRED_SUBSTRING not in classification:
        rejected_ids.append(object_id)
        return False

    # objectName or title must NOT include plural versions of the search queries
    title = (obj.get("title") or "").lower()
    object_name = (obj.get("objectName") or "").lower()
    if _contains_any_term(title, PLURAL_TERMS) or _contains_any_term(object_name, PLURAL_TERMS):
        rejected_ids.append(object_id)
        return False

    # objectName or title must NOT include excluded terms like "shard", "plate", etc.
    if _contains_any_term(title, EXCLUDED_TERMS) or _contains_any_term(object_name, EXCLUDED_TERMS):
        rejected_ids.append(object_id)
        return False

    return True
