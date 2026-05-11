# Run from repo root:
#   python3 format_data/use_groups/sort_use_groups_by_silhouette.py
#
# Reads fields.csv ``use``, format_data/use_groups/representative.json, and
# silhouette_features.csv (same weighted z-vectors as ``compute_shape_neighbors.py``).
# Writes format_data/use_groups/use_group_object_order.json with object IDs per group
# sorted by ascending Euclidean distance to the representative's vector (representative
# first). Same idea as shape cluster object rows sorted by distance to centroid.

from __future__ import annotations

import importlib.util
import json
import math
from pathlib import Path

_REPO = Path(__file__).resolve().parents[2]
_COMPUTE_NEIGHBORS_PATH = _REPO / "format_data" / "compute_shape_neighbors.py"
_REPRESENTATIVE_PATH = _REPO / "format_data" / "use_groups" / "representative.json"
_OUT_PATH = _REPO / "format_data" / "use_groups" / "use_group_object_order.json"

USE_GROUPS_IN_DISPLAY_ORDER = [
    "animal_shaped",
    "ritual",
    "pouring",
    "flask_and_bottle",
    "storage",
    "vase",
    "other",
]


def _load_compute_shape_neighbors():
    spec = importlib.util.spec_from_file_location(
        "compute_shape_neighbors", _COMPUTE_NEIGHBORS_PATH
    )
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def _object_id_str(raw: object) -> str | None:
    if raw is None:
        return None
    if isinstance(raw, bool):
        return None
    if isinstance(raw, int):
        return str(raw)
    if isinstance(raw, float) and math.isfinite(raw):
        return str(int(raw))
    s = str(raw).strip()
    if not s:
        return None
    try:
        return str(int(float(s)))
    except ValueError:
        return s or None


def _representative_ids_for_group(raw: object) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        out: list[str] = []
        for item in raw:
            oid = _object_id_str(item)
            if oid is not None:
                out.append(oid)
        return out
    oid = _object_id_str(raw)
    return [oid] if oid is not None else []


def _l2(a: list[float], b: list[float]) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def main() -> None:
    mod = _load_compute_shape_neighbors()
    fields_by_id, _, _ = mod.load_fields_maps(mod.FIELDS_PATH)
    allowed_ids = set(fields_by_id.keys())
    _ordered, vectors, _feature_cols = mod.build_feature_matrix(mod.SILHOUETTE_PATH, allowed_ids)
    del _ordered
    if not vectors:
        raise SystemExit("No silhouette vectors (check silhouette_features.csv and fields overlap).")

    rep_payload = json.loads(_REPRESENTATIVE_PATH.read_text(encoding="utf-8"))
    if not isinstance(rep_payload, dict):
        raise SystemExit("representative.json must be a JSON object.")

    use_by_id: dict[str, str] = {}
    for oid, row in fields_by_id.items():
        u = (row.get("use") or "").strip().lower()
        if u:
            use_by_id[oid] = u

    out: dict[str, list[str]] = {}

    for group in USE_GROUPS_IN_DISPLAY_ORDER:
        rep_candidates = _representative_ids_for_group(rep_payload.get(group))
        members = sorted(
            (oid for oid, u in use_by_id.items() if u == group),
            key=lambda x: int(x) if x.isdigit() else x,
        )
        if not members:
            out[group] = []
            continue

        anchor_vec: list[float] | None = None
        for cand in rep_candidates:
            if cand in members and cand in vectors:
                anchor_vec = vectors[cand]
                break

        if anchor_vec is None:
            out[group] = sorted(members, key=lambda x: int(x) if x.isdigit() else 0)
            continue

        def sort_key(oid: str) -> tuple[float, int]:
            v = vectors.get(oid)
            if v is None:
                return (float("inf"), int(oid) if oid.isdigit() else 0)
            return (_l2(v, anchor_vec), int(oid) if oid.isdigit() else 0)

        out[group] = sorted(members, key=sort_key)

    _OUT_PATH.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {_OUT_PATH} ({sum(len(v) for v in out.values())} ids across {len(out)} groups)")


if __name__ == "__main__":
    main()
