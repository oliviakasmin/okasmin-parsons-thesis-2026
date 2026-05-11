"""Perceptual palette features for KMeans: Lab v2 (104-D).

Layout:
  - 6 ranked slots × [L/100, a/127, b/127, C/130, p]  (30)
  - 8×8 weighted a*b* histogram (64)
  - relational scalars (10): white_mass, blue_mass, blue_peak, blue_white_interaction,
    top1_p, top2_p, top3_p, palette_entropy, sin(h₁), cos(h₁) for h₁=atan2(b*,a*) of top swatch

v2 adds circular primary hue so orange-brown vs red-brown separates under Euclidean KMeans.
Default block weights de-emphasize histogram vs v1 so shared clay mass bins dominate less.
"""

from __future__ import annotations

from typing import Any, Mapping

import numpy as np
from sklearn.cluster import BisectingKMeans, KMeans
from sklearn.preprocessing import StandardScaler

from .bucket_colors import parse_palette_row
from .lab_color import chroma_from_ab, rgb_uint8_to_lab

COLOR_KMEANS_FEATURE_VERSION = "lab_slots_ab_hist_rel_v2"

# Dimensions
RANKED_SLOTS = 6
FEATS_PER_SLOT = 5  # Ln, an, bn, Cn, proportions already scaled [0,1]
AB_GRID_DEFAULT = 8
HIST_DIM = AB_GRID_DEFAULT * AB_GRID_DEFAULT  # 64 for v1
REL_DIM = 10
EXPECTED_FEATURE_DIM = RANKED_SLOTS * FEATS_PER_SLOT + HIST_DIM + REL_DIM  # 104

# Histogram bounds (a*, b*) — clip then bin
AB_HIST_MIN = -110.0
AB_HIST_MAX = 110.0

# Block weights before global StandardScaler (lower hist → less “everyone shares clay bins” collapse)
DEFAULT_WEIGHT_RANKED = 1.1
DEFAULT_WEIGHT_HIST = 0.95
DEFAULT_WEIGHT_REL = 1.0


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def _palette_entropy(p: np.ndarray) -> float:
    p = np.clip(p, 1e-12, 1.0)
    return float(-np.sum(p * np.log(p)))


def _soft_white_mass(L: float, C: float) -> float:
    """High L*, low chroma → near white / cream in Lab."""
    w = _sigmoid((L - 78.0) / 5.0) * _sigmoid((18.0 - C) / 4.0)
    return float(w)


def _soft_blue_mass(a: np.ndarray, b: np.ndarray, C: np.ndarray) -> np.ndarray:
    """Per-swatch soft blue membership: chroma + negative b* (blue-yellow axis)."""
    ch = _sigmoid((C - 12.0) / 3.5)
    b_blue = _sigmoid((-b - 6.0) / 12.0)
    return ch * b_blue


def _histogram_ab_bilinear(
    a: np.ndarray,
    b: np.ndarray,
    p: np.ndarray,
    grid: int = AB_GRID_DEFAULT,
) -> np.ndarray:
    """Spread each swatch's p across 2×2 bins with bilinear weights. Returns length grid²."""
    hist = np.zeros(grid * grid, dtype=np.float64)
    span = AB_HIST_MAX - AB_HIST_MIN
    for i in range(len(p)):
        aa = float(np.clip(a[i], AB_HIST_MIN, AB_HIST_MAX))
        bb = float(np.clip(b[i], AB_HIST_MIN, AB_HIST_MAX))
        pi = float(p[i])
        if pi <= 0:
            continue
        # continuous index in [0, grid-1]
        u = (aa - AB_HIST_MIN) / span * (grid - 1)
        v = (bb - AB_HIST_MIN) / span * (grid - 1)
        i0 = int(np.floor(u))
        j0 = int(np.floor(v))
        i0 = max(0, min(i0, grid - 2))
        j0 = max(0, min(j0, grid - 2))
        i1, j1 = i0 + 1, j0 + 1
        wi1, wj1 = u - i0, v - j0
        wi0, wj0 = 1.0 - wi1, 1.0 - wj1
        for (ig, jg, w) in [
            (i0, j0, wi0 * wj0),
            (i1, j0, wi1 * wj0),
            (i0, j1, wi0 * wj1),
            (i1, j1, wi1 * wj1),
        ]:
            hist[ig * grid + jg] += pi * w
    return hist


def palette_to_feature_vector(
    row: Mapping[str, Any],
    *,
    ranked_slots: int = RANKED_SLOTS,
    ab_grid: int = AB_GRID_DEFAULT,
    w_ranked: float = DEFAULT_WEIGHT_RANKED,
    w_hist: float = DEFAULT_WEIGHT_HIST,
    w_rel: float = DEFAULT_WEIGHT_REL,
) -> np.ndarray | None:
    """Build 104-D weighted feature vector, or None if no palette."""
    palette = parse_palette_row(row)
    if not palette:
        return None

    total_p = sum(float(item["proportion"]) for item in palette)
    if total_p <= 0:
        return None
    for item in palette:
        item["proportion"] = float(item["proportion"]) / total_p

    n = len(palette)
    ordered = sorted(palette, key=lambda item: -item["proportion"])
    Ls = np.zeros(n, dtype=np.float64)
    As = np.zeros(n, dtype=np.float64)
    Bs = np.zeros(n, dtype=np.float64)
    Cs = np.zeros(n, dtype=np.float64)
    ps = np.zeros(n, dtype=np.float64)
    for i, item in enumerate(ordered):
        r, g, b = item["rgb"]
        p = float(item["proportion"])
        L, a, b_ = rgb_uint8_to_lab((r, g, b))
        Ls[i], As[i], Bs[i] = L, a, b_
        Cs[i] = chroma_from_ab(a, b_)
        ps[i] = p

    # --- Ranked block ---
    ranked = np.zeros(RANKED_SLOTS * FEATS_PER_SLOT, dtype=np.float64)
    for i in range(min(RANKED_SLOTS, len(ordered), ranked_slots)):
        base = i * FEATS_PER_SLOT
        ranked[base] = Ls[i] / 100.0
        ranked[base + 1] = As[i] / 127.0
        ranked[base + 2] = Bs[i] / 127.0
        ranked[base + 3] = Cs[i] / 130.0
        ranked[base + 4] = ps[i]

    # --- a*b* histogram ---
    hist = _histogram_ab_bilinear(As, Bs, ps, grid=ab_grid)
    expected_hist = ab_grid * ab_grid
    if hist.shape[0] != expected_hist:
        raise ValueError(f"Histogram dim mismatch: {hist.shape[0]} vs {expected_hist}")

    # --- Relational ---
    white_per_sw = np.array([_soft_white_mass(Ls[i], Cs[i]) for i in range(n)], dtype=np.float64)
    white_mass = float(np.sum(ps * white_per_sw))

    blue_soft = _soft_blue_mass(As, Bs, Cs)
    blue_mass = float(np.sum(ps * blue_soft))

    strong_blue_mask = blue_soft > 0.35
    blue_peak = float(np.max(np.where(strong_blue_mask, ps, 0.0))) if n else 0.0

    blue_white_interaction = white_mass * blue_peak

    top1_p = float(ps[0]) if n > 0 else 0.0
    top2_p = float(ps[1]) if n > 1 else 0.0
    top3_p = float(ps[2]) if n > 2 else 0.0
    palette_ent = _palette_entropy(ps)

    # Primary hue in a*b* plane (circular); helps split analogous browns vs relying on (a,b) alone
    a0 = float(As[0]) if n > 0 else 0.0
    b0 = float(Bs[0]) if n > 0 else 0.0
    h0 = float(np.arctan2(b0, a0))
    sin_h0, cos_h0 = np.sin(h0), np.cos(h0)

    rel = np.array(
        [
            white_mass,
            blue_mass,
            blue_peak,
            blue_white_interaction,
            top1_p,
            top2_p,
            top3_p,
            palette_ent,
            sin_h0,
            cos_h0,
        ],
        dtype=np.float64,
    )

    weighted = np.concatenate(
        [
            ranked * w_ranked,
            hist * w_hist,
            rel * w_rel,
        ]
    )
    expected_dim = RANKED_SLOTS * FEATS_PER_SLOT + ab_grid * ab_grid + REL_DIM
    if weighted.shape[0] != expected_dim:
        raise ValueError(f"Feature dim {weighted.shape[0]} != {expected_dim}")
    return weighted


def run_kmeans_on_palette_vectors(
    X: np.ndarray,
    n_clusters: int,
    random_state: int = 42,
    *,
    backend: str = "lloyd",
) -> tuple[np.ndarray, int, KMeans | BisectingKMeans, StandardScaler]:
    """Fit StandardScaler + KMeans (or BisectingKMeans) on *X* only (eligible rows)."""
    n_samples = X.shape[0]
    if n_samples == 0:
        raise ValueError("No samples for KMeans.")
    k_effective = int(min(n_clusters, n_samples))
    if k_effective < 1:
        raise ValueError("n_clusters must be >= 1 after clipping to sample count.")

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    if backend == "bisecting":
        kmeans = BisectingKMeans(
            n_clusters=k_effective,
            random_state=random_state,
        )
    elif backend == "lloyd":
        kmeans = KMeans(
            n_clusters=k_effective,
            random_state=random_state,
            n_init=25,
        )
    else:
        raise ValueError(f"Unknown KMeans backend: {backend!r} (use 'lloyd' or 'bisecting')")
    labels = kmeans.fit_predict(X_scaled)
    return labels, k_effective, kmeans, scaler
