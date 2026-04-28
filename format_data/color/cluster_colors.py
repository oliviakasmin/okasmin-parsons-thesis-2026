from __future__ import annotations

import colorsys

import numpy as np


def _hex_to_rgb01(hex_color: str) -> tuple[float, float, float]:
    value = hex_color.lstrip("#")
    if len(value) != 6:
        raise ValueError(f"Invalid hex color: {hex_color}")
    r = int(value[0:2], 16) / 255.0
    g = int(value[2:4], 16) / 255.0
    b = int(value[4:6], 16) / 255.0
    return r, g, b


def palette_to_feature_vector(colors_hex: list[str], shares: list[float]) -> np.ndarray:
    weights = np.array(shares, dtype=np.float64)
    if weights.sum() <= 0:
        weights = np.ones(len(colors_hex), dtype=np.float64)
    weights = weights / weights.sum()

    hsv_values = []
    for color in colors_hex:
        r, g, b = _hex_to_rgb01(color)
        h, s, v = colorsys.rgb_to_hsv(r, g, b)
        hsv_values.append((h, s, v))
    hsv = np.array(hsv_values, dtype=np.float64)

    hue_angles = hsv[:, 0] * 2.0 * np.pi
    hue_x = float(np.sum(np.cos(hue_angles) * weights))
    hue_y = float(np.sum(np.sin(hue_angles) * weights))
    sat_mean = float(np.sum(hsv[:, 1] * weights))
    val_mean = float(np.sum(hsv[:, 2] * weights))
    sat_std = float(np.sqrt(np.sum(((hsv[:, 1] - sat_mean) ** 2) * weights)))
    val_std = float(np.sqrt(np.sum(((hsv[:, 2] - val_mean) ** 2) * weights)))

    top_r, top_g, top_b = _hex_to_rgb01(colors_hex[0])
    return np.array(
        [hue_x, hue_y, sat_mean, val_mean, sat_std, val_std, top_r, top_g, top_b],
        dtype=np.float64,
    )


def _kmeans(features: np.ndarray, k: int, seed: int = 42, max_iter: int = 100) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    n_samples = features.shape[0]
    if k <= 0 or n_samples == 0:
        raise ValueError("Invalid kmeans inputs.")
    if n_samples < k:
        raise ValueError("k cannot be larger than sample count.")

    indices = rng.choice(n_samples, size=k, replace=False)
    centroids = features[indices].copy()
    labels = np.zeros(n_samples, dtype=np.int32)

    for _ in range(max_iter):
        distances = np.linalg.norm(features[:, None, :] - centroids[None, :, :], axis=2)
        new_labels = np.argmin(distances, axis=1).astype(np.int32)
        if np.array_equal(new_labels, labels):
            break
        labels = new_labels

        for cluster_id in range(k):
            cluster_points = features[labels == cluster_id]
            if cluster_points.shape[0] == 0:
                centroids[cluster_id] = features[rng.integers(0, n_samples)]
            else:
                centroids[cluster_id] = cluster_points.mean(axis=0)

    return labels, centroids


def cluster_palette_features(features: np.ndarray, max_groups: int = 10, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    if features.shape[0] == 0:
        return np.array([], dtype=np.int32), np.empty((0, 0), dtype=np.float64)
    k = min(max_groups, features.shape[0])
    labels, centroids = _kmeans(features=features, k=k, seed=seed)
    return labels, centroids


def _label_from_hsv(hue_x: float, hue_y: float, sat_mean: float, val_mean: float) -> str:
    hue = (np.arctan2(hue_y, hue_x) / (2.0 * np.pi)) % 1.0
    if sat_mean < 0.12 and val_mean > 0.78:
        return "white"
    if sat_mean < 0.12 and val_mean < 0.22:
        return "black"
    if sat_mean < 0.12:
        return "gray"
    if hue < 0.04 or hue >= 0.96:
        return "red"
    if hue < 0.11:
        return "orange"
    if hue < 0.18:
        return "yellow"
    if hue < 0.45:
        return "green"
    if hue < 0.70:
        return "blue"
    if hue < 0.85:
        return "purple"
    return "pink"


def label_centroids(centroids: np.ndarray) -> list[str]:
    labels: list[str] = []
    for centroid in centroids:
        hue_x = float(centroid[0])
        hue_y = float(centroid[1])
        sat_mean = float(centroid[2])
        val_mean = float(centroid[3])
        labels.append(_label_from_hsv(hue_x, hue_y, sat_mean, val_mean))
    return labels


def top_hue_bin_share(colors_hex: list[str], shares: list[float], hue_bins: int = 12) -> float:
    if hue_bins <= 1:
        raise ValueError("hue_bins must be > 1")
    if not colors_hex or not shares:
        return 0.0

    weights = np.array(shares, dtype=np.float64)
    if weights.sum() <= 0:
        return 0.0
    weights = weights / weights.sum()

    bins = np.zeros(hue_bins, dtype=np.float64)
    for color, weight in zip(colors_hex, weights):
        r, g, b = _hex_to_rgb01(color)
        hue, _, _ = colorsys.rgb_to_hsv(r, g, b)
        idx = min(hue_bins - 1, int(hue * hue_bins))
        bins[idx] += float(weight)
    return float(bins.max())


def hue_family_shares(colors_hex: list[str], shares: list[float]) -> dict[str, float]:
    families = {
        "red": 0.0,
        "orange": 0.0,
        "yellow": 0.0,
        "green": 0.0,
        "blue": 0.0,
        "purple": 0.0,
        "neutral": 0.0,
    }
    if not colors_hex or not shares:
        return families

    weights = np.array(shares, dtype=np.float64)
    if weights.sum() <= 0:
        return families
    weights = weights / weights.sum()

    for color, weight in zip(colors_hex, weights):
        r, g, b = _hex_to_rgb01(color)
        hue, sat, val = colorsys.rgb_to_hsv(r, g, b)
        if sat < 0.12:
            families["neutral"] += float(weight)
            continue
        if hue < 0.04 or hue >= 0.92:
            families["red"] += float(weight)
        elif hue < 0.11:
            families["orange"] += float(weight)
        elif hue < 0.18:
            families["yellow"] += float(weight)
        elif hue < 0.45:
            families["green"] += float(weight)
        elif hue < 0.72:
            families["blue"] += float(weight)
        else:
            # Fold pink/magenta into purple for simpler combo recipes.
            families["purple"] += float(weight)
    return families


def weighted_palette_embedding(
    colors_hex: list[str], shares: list[float], max_colors: int = 8
) -> np.ndarray:
    if max_colors <= 0:
        raise ValueError("max_colors must be > 0")
    if not colors_hex or not shares:
        return np.zeros(max_colors * 5, dtype=np.float64)

    pairs = list(zip(colors_hex, shares))
    pairs.sort(key=lambda item: float(item[1]), reverse=True)
    pairs = pairs[:max_colors]

    weights = np.array([max(0.0, float(item[1])) for item in pairs], dtype=np.float64)
    if weights.sum() <= 0:
        weights = np.ones(len(pairs), dtype=np.float64)
    weights = weights / weights.sum()

    feature_values: list[float] = []
    for (color, _), weight in zip(pairs, weights):
        r, g, b = _hex_to_rgb01(color)
        h, s, v = colorsys.rgb_to_hsv(r, g, b)
        angle = h * 2.0 * np.pi
        feature_values.extend([np.cos(angle), np.sin(angle), s, v, float(weight)])

    while len(feature_values) < max_colors * 5:
        feature_values.extend([0.0, 0.0, 0.0, 0.0, 0.0])

    return np.array(feature_values, dtype=np.float64)
