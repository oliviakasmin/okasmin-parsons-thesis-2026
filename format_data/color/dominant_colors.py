from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image


@dataclass
class DominantColorResult:
    colors_hex: list[str]
    shares: list[float]
    foreground_pixels: int


def _rgb_to_hex(rgb: np.ndarray) -> str:
    r, g, b = [int(v) for v in rgb]
    return f"#{r:02x}{g:02x}{b:02x}"


def _sample_rows(rows: np.ndarray, max_sampled_pixels: int) -> np.ndarray:
    if rows.shape[0] <= max_sampled_pixels:
        return rows
    step = max(1, rows.shape[0] // max_sampled_pixels)
    sampled = rows[::step]
    if sampled.shape[0] > max_sampled_pixels:
        sampled = sampled[:max_sampled_pixels]
    return sampled


def extract_dominant_colors(
    image_path: Path,
    n_colors: int = 8,
    alpha_threshold: int = 1,
    quantization_levels: int = 32,
    max_sampled_pixels: int = 200_000,
) -> DominantColorResult:
    if quantization_levels <= 1:
        raise ValueError("quantization_levels must be > 1")

    with Image.open(image_path) as image:
        rgba = np.array(image.convert("RGBA"), dtype=np.uint8)

    alpha = rgba[:, :, 3]
    mask = alpha >= alpha_threshold
    rgb = rgba[:, :, :3]
    foreground = rgb[mask]
    if foreground.size == 0:
        raise ValueError("No visible foreground pixels in no-bg image.")

    sampled = _sample_rows(foreground, max_sampled_pixels=max_sampled_pixels)
    scale = quantization_levels / 256.0
    quantized = np.floor(sampled.astype(np.float32) * scale).astype(np.int32)
    quantized = np.clip(quantized, 0, quantization_levels - 1)

    q0 = quantized[:, 0]
    q1 = quantized[:, 1]
    q2 = quantized[:, 2]
    bin_ids = q0 * (quantization_levels**2) + q1 * quantization_levels + q2

    total_bins = quantization_levels**3
    counts = np.bincount(bin_ids, minlength=total_bins)
    non_zero_bins = np.flatnonzero(counts > 0)
    if non_zero_bins.size == 0:
        raise ValueError("Unable to compute color bins from sampled pixels.")

    order = non_zero_bins[np.argsort(counts[non_zero_bins])[::-1]]
    top_bins = order[:n_colors]

    sums_r = np.bincount(bin_ids, weights=sampled[:, 0], minlength=total_bins)
    sums_g = np.bincount(bin_ids, weights=sampled[:, 1], minlength=total_bins)
    sums_b = np.bincount(bin_ids, weights=sampled[:, 2], minlength=total_bins)

    colors_hex: list[str] = []
    shares: list[float] = []
    total = float(sampled.shape[0])

    for bin_id in top_bins:
        count = float(counts[bin_id])
        if count <= 0:
            continue
        mean_rgb = np.array(
            [sums_r[bin_id] / count, sums_g[bin_id] / count, sums_b[bin_id] / count], dtype=np.float32
        )
        colors_hex.append(_rgb_to_hex(np.round(mean_rgb).astype(np.int32)))
        shares.append(count / total)

    # Keep a stable shape for downstream CSV storage.
    while len(colors_hex) < n_colors:
        colors_hex.append("#000000")
        shares.append(0.0)

    return DominantColorResult(
        colors_hex=colors_hex[:n_colors],
        shares=shares[:n_colors],
        foreground_pixels=int(foreground.shape[0]),
    )
