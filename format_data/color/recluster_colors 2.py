from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from .cluster_colors import (
    _kmeans,
    hue_family_shares,
    top_hue_bin_share,
    weighted_palette_embedding,
)

ROOT = Path(__file__).resolve().parents[2]
GENERATED_DIR = ROOT / "format_data" / "generated"
COLOR_FIELDS_PATH = GENERATED_DIR / "object_color_fields.csv"
CENTROIDS_PATH = GENERATED_DIR / "object_color_cluster_centroids.csv"
GROUP_LABELS_PATH = GENERATED_DIR / "object_color_group_labels.csv"
RUN_STATS_PATH = GENERATED_DIR / "object_color_cluster_stats.json"

SINGLE_GROUPS = [
    {"id": 1, "key": "blue", "label": "blue"},
    {"id": 2, "key": "green", "label": "green"},
]
MULTICOLOR_GROUP = {"id": 0, "key": "multicolor", "label": "multicolor"}
SINGLE_GROUP_BY_KEY = {entry["key"]: entry for entry in SINGLE_GROUPS}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Re-cluster existing dominant-color outputs without rerunning image extraction."
    )
    parser.add_argument("--max-groups", type=int, default=10, help="Total groups including all stages.")
    parser.add_argument(
        "--multicolor-threshold",
        type=float,
        default=0.6,
        help="If top hue-bin share is below this, residual objects become multicolor.",
    )
    parser.add_argument(
        "--hue-bins",
        type=int,
        default=12,
        help="Hue bins used for multicolor concentration check.",
    )
    parser.add_argument(
        "--single-threshold",
        type=float,
        default=0.72,
        help="Minimum hue-family share to qualify for strict single-color group.",
    )
    parser.add_argument(
        "--single-secondary-cap",
        type=float,
        default=0.22,
        help="Max other chromatic share allowed for strict single-color assignment.",
    )
    parser.add_argument(
        "--combo-min-groups",
        type=int,
        default=4,
        help="Minimum combo groups for residual clustering when enough samples exist.",
    )
    parser.add_argument(
        "--combo-max-groups",
        type=int,
        default=6,
        help="Maximum combo groups for residual clustering.",
    )
    parser.add_argument(
        "--combo-min-size",
        type=int,
        default=50,
        help="Approximate minimum cluster size target to pick combo group count.",
    )
    parser.add_argument(
        "--combo-confidence-threshold",
        type=float,
        default=0.35,
        help="Residual cluster confidence floor. Lower-confidence residuals fallback to multicolor.",
    )
    return parser.parse_args()


def _parse_json_list(value: str) -> list:
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return parsed
    except Exception:  # noqa: BLE001
        pass
    return []


def _safe_recipe_from_families(families: dict[str, float], top_n: int = 2) -> str:
    ordered = sorted(families.items(), key=lambda item: item[1], reverse=True)
    parts = [f"{name}:{value:.2f}" for name, value in ordered[:top_n] if value > 0]
    return "+".join(parts) if parts else "mixed:0.00"


def _pick_combo_group_count(
    residual_count: int,
    available_slots: int,
    combo_min_groups: int,
    combo_max_groups: int,
    combo_min_size: int,
) -> int:
    if residual_count <= 0 or available_slots <= 0:
        return 0
    max_allowed = min(available_slots, combo_max_groups, residual_count)
    if max_allowed <= 0:
        return 0

    candidate = max(1, residual_count // max(1, combo_min_size))
    candidate = max(combo_min_groups, candidate)
    return min(max_allowed, candidate)


def _combo_confidence_scores(features: np.ndarray, labels: np.ndarray, centroids: np.ndarray) -> np.ndarray:
    scores = np.zeros(features.shape[0], dtype=np.float64)
    if features.shape[0] == 0:
        return scores

    for cluster_id in range(centroids.shape[0]):
        idx = np.flatnonzero(labels == cluster_id)
        if idx.size == 0:
            continue
        dists = np.linalg.norm(features[idx] - centroids[cluster_id], axis=1)
        max_dist = float(dists.max())
        if max_dist <= 1e-9:
            scores[idx] = 1.0
        else:
            scores[idx] = 1.0 - (dists / max_dist)
    return scores


def _single_group_match(
    families: dict[str, float], single_threshold: float, secondary_cap: float
) -> dict | None:
    for key in ("blue", "green"):
        primary = float(families.get(key, 0.0))
        secondary = sum(
            float(value)
            for name, value in families.items()
            if name not in {key, "neutral"}
        )
        if primary >= single_threshold and secondary <= secondary_cap:
            return SINGLE_GROUP_BY_KEY[key]
    return None

def run_reclustering(
    max_groups: int = 10,
    multicolor_threshold: float = 0.6,
    hue_bins: int = 12,
    single_threshold: float = 0.72,
    single_secondary_cap: float = 0.22,
    combo_min_groups: int = 4,
    combo_max_groups: int = 6,
    combo_min_size: int = 50,
    combo_confidence_threshold: float = 0.35,
) -> dict:
    if not COLOR_FIELDS_PATH.exists():
        raise FileNotFoundError(f"Missing input file: {COLOR_FIELDS_PATH}")
    if max_groups < 2:
        raise ValueError("max_groups must be >= 2 so there is room for multicolor + color groups.")

    df = pd.read_csv(COLOR_FIELDS_PATH)
    for col in [
        "color_group_id",
        "color_group_label",
        "color_group_key",
        "color_group_type",
        "color_group_confidence",
    ]:
        if col not in df.columns:
            df[col] = ""
        else:
            df[col] = ""

    eligible_mask = (df.get("color_eligible", False) == True) & (  # noqa: E712
        df.get("color_analysis_status", "") == "eligible"
    )
    eligible_idx = list(df.index[eligible_mask])

    group_counts: dict[str, int] = {}
    single_count = 0
    combo_count = 0
    multicolor_count = 0
    residual_indices: list[int] = []
    residual_embeddings: list[np.ndarray] = []
    residual_families: list[dict[str, float]] = []

    for idx in eligible_idx:
        colors_hex = _parse_json_list(str(df.at[idx, "dominant_colors_hex"]))
        shares = _parse_json_list(str(df.at[idx, "dominant_colors_share"]))
        if not colors_hex or not shares or len(colors_hex) != len(shares):
            continue

        families = hue_family_shares(colors_hex=colors_hex, shares=shares)
        single_group = _single_group_match(
            families=families,
            single_threshold=single_threshold,
            secondary_cap=single_secondary_cap,
        )
        if single_group:
            key = str(single_group["key"])
            df.at[idx, "color_group_id"] = int(single_group["id"])
            df.at[idx, "color_group_key"] = key
            df.at[idx, "color_group_label"] = key
            df.at[idx, "color_group_type"] = "single"
            df.at[idx, "color_group_confidence"] = round(float(families.get(key, 0.0)), 6)
            group_counts[key] = group_counts.get(key, 0) + 1
            single_count += 1
            continue

        residual_indices.append(idx)
        residual_embeddings.append(weighted_palette_embedding(colors_hex=colors_hex, shares=shares))
        residual_families.append(families)

    available_slots_for_combo = max(0, max_groups - 1 - len(SINGLE_GROUPS))
    combo_group_count = _pick_combo_group_count(
        residual_count=len(residual_indices),
        available_slots=available_slots_for_combo,
        combo_min_groups=combo_min_groups,
        combo_max_groups=combo_max_groups,
        combo_min_size=combo_min_size,
    )

    centroid_rows: list[dict] = []
    mapping_rows: list[dict] = [
        {
            "color_group_id": int(MULTICOLOR_GROUP["id"]),
            "color_group_key": str(MULTICOLOR_GROUP["key"]),
            "color_group_label": str(MULTICOLOR_GROUP["label"]),
            "color_group_type": "multicolor",
            "color_group_recipe": "mixed",
        }
    ]
    for group in SINGLE_GROUPS:
        mapping_rows.append(
            {
                "color_group_id": int(group["id"]),
                "color_group_key": str(group["key"]),
                "color_group_label": str(group["label"]),
                "color_group_type": "single",
                "color_group_recipe": f"{group['key']}:strict",
            }
        )

    if combo_group_count > 0 and residual_embeddings:
        features = np.vstack(residual_embeddings)
        labels, centroids = _kmeans(features=features, k=combo_group_count)
        confidence_scores = _combo_confidence_scores(features=features, labels=labels, centroids=centroids)

        combo_meta = []
        for cluster_id in range(combo_group_count):
            idx = np.flatnonzero(labels == cluster_id)
            if idx.size == 0:
                combo_meta.append((cluster_id, "mixed:0.00", "mixed"))
                continue
            family_total = {
                "red": 0.0,
                "orange": 0.0,
                "yellow": 0.0,
                "green": 0.0,
                "blue": 0.0,
                "purple": 0.0,
                "neutral": 0.0,
            }
            for i in idx:
                for name, value in residual_families[int(i)].items():
                    family_total[name] += float(value)
            for name in family_total:
                family_total[name] /= float(idx.size)
            recipe = _safe_recipe_from_families(family_total, top_n=2)
            label = recipe.replace(":", " ").replace("+", " + ")
            combo_meta.append((cluster_id, recipe, label))

        # Stable key ordering by cluster size, then recipe.
        cluster_sizes = {cluster_id: int((labels == cluster_id).sum()) for cluster_id in range(combo_group_count)}
        ordered_clusters = sorted(
            range(combo_group_count),
            key=lambda cid: (-cluster_sizes[cid], combo_meta[cid][1]),
        )
        combo_id_by_cluster = {cid: 100 + rank for rank, cid in enumerate(ordered_clusters)}
        combo_key_by_cluster = {cid: f"combo_{rank + 1}" for rank, cid in enumerate(ordered_clusters)}

        for cluster_id in range(combo_group_count):
            mapped_id = combo_id_by_cluster[cluster_id]
            mapped_key = combo_key_by_cluster[cluster_id]
            recipe = combo_meta[cluster_id][1]
            label = combo_meta[cluster_id][2]
            mapping_rows.append(
                {
                    "color_group_id": mapped_id,
                    "color_group_key": mapped_key,
                    "color_group_label": label,
                    "color_group_type": "combo",
                    "color_group_recipe": recipe,
                }
            )
            centroid_rows.append(
                {
                    "color_group_id": mapped_id,
                    "color_group_key": mapped_key,
                    "color_group_label": label,
                    "color_group_type": "combo",
                    "hue_x": float(centroids[cluster_id][0]),
                    "hue_y": float(centroids[cluster_id][1]),
                    "sat_mean": float(np.clip(centroids[cluster_id][2], 0.0, 1.0)),
                    "val_mean": float(np.clip(centroids[cluster_id][3], 0.0, 1.0)),
                }
            )

        for row_idx, cluster_id, confidence in zip(residual_indices, labels, confidence_scores):
            top_share = top_hue_bin_share(
                colors_hex=_parse_json_list(str(df.at[row_idx, "dominant_colors_hex"])),
                shares=_parse_json_list(str(df.at[row_idx, "dominant_colors_share"])),
                hue_bins=hue_bins,
            )
            if top_share < multicolor_threshold or float(confidence) < combo_confidence_threshold:
                df.at[row_idx, "color_group_id"] = int(MULTICOLOR_GROUP["id"])
                df.at[row_idx, "color_group_key"] = str(MULTICOLOR_GROUP["key"])
                df.at[row_idx, "color_group_label"] = str(MULTICOLOR_GROUP["label"])
                df.at[row_idx, "color_group_type"] = "multicolor"
                df.at[row_idx, "color_group_confidence"] = round(float(top_share), 6)
                multicolor_count += 1
                group_counts["multicolor"] = group_counts.get("multicolor", 0) + 1
            else:
                cluster_id = int(cluster_id)
                combo_id = combo_id_by_cluster[cluster_id]
                combo_key = combo_key_by_cluster[cluster_id]
                recipe = combo_meta[cluster_id][1]
                label = combo_meta[cluster_id][2]
                df.at[row_idx, "color_group_id"] = combo_id
                df.at[row_idx, "color_group_key"] = combo_key
                df.at[row_idx, "color_group_label"] = label
                df.at[row_idx, "color_group_type"] = "combo"
                df.at[row_idx, "color_group_confidence"] = round(float(confidence), 6)
                combo_count += 1
                group_counts[combo_key] = group_counts.get(combo_key, 0) + 1
    else:
        for row_idx in residual_indices:
            top_share = top_hue_bin_share(
                colors_hex=_parse_json_list(str(df.at[row_idx, "dominant_colors_hex"])),
                shares=_parse_json_list(str(df.at[row_idx, "dominant_colors_share"])),
                hue_bins=hue_bins,
            )
            df.at[row_idx, "color_group_id"] = 0
            df.at[row_idx, "color_group_key"] = str(MULTICOLOR_GROUP["key"])
            df.at[row_idx, "color_group_label"] = str(MULTICOLOR_GROUP["label"])
            df.at[row_idx, "color_group_type"] = "multicolor"
            df.at[row_idx, "color_group_confidence"] = round(float(top_share), 6)
            multicolor_count += 1
            group_counts["multicolor"] = group_counts.get("multicolor", 0) + 1

    df.to_csv(COLOR_FIELDS_PATH, index=False)
    pd.DataFrame(centroid_rows).to_csv(CENTROIDS_PATH, index=False)
    pd.DataFrame(mapping_rows).to_csv(GROUP_LABELS_PATH, index=False)

    stats = {
        "rows_total": int(len(df)),
        "eligible_rows": int(len(eligible_idx)),
        "single_count": int(single_count),
        "combo_count": int(combo_count),
        "multicolor_count": int(multicolor_count),
        "clustered_non_multicolor_count": int(single_count + combo_count),
        "max_groups_requested": int(max_groups),
        "combo_groups_created": int(combo_group_count),
        "group_count_including_multicolor": int(1 + len(SINGLE_GROUPS) + combo_group_count),
        "group_counts": {str(group_key): int(count) for group_key, count in sorted(group_counts.items())},
        "multicolor_threshold": float(multicolor_threshold),
        "hue_bins": int(hue_bins),
        "single_threshold": float(single_threshold),
        "single_secondary_cap": float(single_secondary_cap),
        "combo_min_groups": int(combo_min_groups),
        "combo_max_groups": int(combo_max_groups),
        "combo_min_size": int(combo_min_size),
        "combo_confidence_threshold": float(combo_confidence_threshold),
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "color_fields_path": str(COLOR_FIELDS_PATH),
        "centroids_path": str(CENTROIDS_PATH),
        "group_labels_path": str(GROUP_LABELS_PATH),
    }
    RUN_STATS_PATH.write_text(json.dumps(stats, indent=2), encoding="utf-8")
    return stats


def main() -> None:
    args = parse_args()
    stats = run_reclustering(
        max_groups=args.max_groups,
        multicolor_threshold=args.multicolor_threshold,
        hue_bins=args.hue_bins,
        single_threshold=args.single_threshold,
        single_secondary_cap=args.single_secondary_cap,
        combo_min_groups=args.combo_min_groups,
        combo_max_groups=args.combo_max_groups,
        combo_min_size=args.combo_min_size,
        combo_confidence_threshold=args.combo_confidence_threshold,
    )
    print(f"Updated {stats['color_fields_path']}")
    print(f"Saved centroids to {stats['centroids_path']}")
    print(f"Saved group labels to {stats['group_labels_path']}")
    print(
        "groups_total="
        f"{stats['group_count_including_multicolor']} "
        f"multicolor={stats['multicolor_count']}"
    )


if __name__ == "__main__":
    main()
