from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image


@dataclass
class PixelSnappedPaletteResult:
    colors_hex: list[str]
    shares: list[float]
    foreground_pixels: int
    colorgram_palette_hex: list[str]
    colorgram_palette_share: list[float]
    colorgram_palette_rgb: list[list[int]]
    colorgram_palette_hsl: list[list[int]]
    colorgram_dominant_hex: str
    colorgram_dominant_share: float


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


def _load_foreground_rgb(image_path: Path, alpha_threshold: int) -> np.ndarray:
    with Image.open(image_path) as image:
        rgba = np.array(image.convert("RGBA"), dtype=np.uint8)
    mask = rgba[:, :, 3] >= alpha_threshold
    foreground = rgba[:, :, :3][mask]
    if foreground.size == 0:
        raise ValueError("No visible foreground pixels in no-bg image.")
    return foreground


def extract_pixel_snapped_palette(
    image_path: Path,
    n_colors: int = 8,
    alpha_threshold: int = 1,
    max_sampled_pixels: int = 200_000,
) -> PixelSnappedPaletteResult:
    import colorgram

    if n_colors <= 0:
        raise ValueError("n_colors must be > 0")

    foreground = _load_foreground_rgb(image_path=image_path, alpha_threshold=alpha_threshold)
    sampled = _sample_rows(foreground, max_sampled_pixels=max_sampled_pixels)
    sampled_img = Image.fromarray(sampled.reshape((-1, 1, 3)).astype(np.uint8), mode="RGB")
    colors = colorgram.extract(sampled_img, n_colors)
    if not colors:
        raise ValueError("colorgram returned an empty palette.")

    palette_rgb = [np.array([color.rgb.r, color.rgb.g, color.rgb.b], dtype=np.int32) for color in colors]
    palette_hex = [_rgb_to_hex(rgb) for rgb in palette_rgb]
    palette_share = [float(color.proportion) for color in colors]
    palette_hsl = [[int(color.hsl.h), int(color.hsl.s), int(color.hsl.l)] for color in colors]
    palette_rgb_list = [[int(color.rgb.r), int(color.rgb.g), int(color.rgb.b)] for color in colors]

    share_total = float(sum(palette_share))
    shares = [value / share_total if share_total > 0 else 0.0 for value in palette_share]
    colors_hex = list(palette_hex)
    while len(colors_hex) < n_colors:
        colors_hex.append("#000000")
        shares.append(0.0)

    return PixelSnappedPaletteResult(
        colors_hex=colors_hex[:n_colors],
        shares=shares[:n_colors],
        foreground_pixels=int(foreground.shape[0]),
        colorgram_palette_hex=palette_hex,
        colorgram_palette_share=shares,
        colorgram_palette_rgb=palette_rgb_list,
        colorgram_palette_hsl=palette_hsl,
        colorgram_dominant_hex=palette_hex[0] if palette_hex else "",
        colorgram_dominant_share=shares[0] if shares else 0.0,
    )

