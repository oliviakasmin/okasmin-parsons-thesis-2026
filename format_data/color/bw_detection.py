from __future__ import annotations

import io
from dataclasses import dataclass
from urllib.request import Request, urlopen

import numpy as np
from PIL import Image


@dataclass
class BWCheckResult:
    is_grayscale: bool
    grayscale_ratio: float
    sampled_pixels: int


def _load_rgb_from_url(image_url: str, timeout_seconds: float = 20.0) -> np.ndarray:
    request = Request(image_url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=timeout_seconds) as response:
        image_bytes = response.read()
    with Image.open(io.BytesIO(image_bytes)) as image:
        rgb = image.convert("RGB")
        return np.array(rgb, dtype=np.uint8)


def _sample_pixels(rgb_pixels: np.ndarray, max_sampled_pixels: int) -> np.ndarray:
    flat = rgb_pixels.reshape(-1, 3)
    if flat.shape[0] <= max_sampled_pixels:
        return flat

    step = max(1, flat.shape[0] // max_sampled_pixels)
    sampled = flat[::step]
    if sampled.shape[0] > max_sampled_pixels:
        sampled = sampled[:max_sampled_pixels]
    return sampled


def check_image_url_grayscale(
    image_url: str,
    channel_tolerance: int = 1,
    grayscale_ratio_threshold: float = 0.995,
    max_sampled_pixels: int = 250_000,
    timeout_seconds: float = 20.0,
) -> BWCheckResult:
    rgb = _load_rgb_from_url(image_url=image_url, timeout_seconds=timeout_seconds)
    sampled = _sample_pixels(rgb_pixels=rgb, max_sampled_pixels=max_sampled_pixels)
    if sampled.size == 0:
        return BWCheckResult(is_grayscale=False, grayscale_ratio=0.0, sampled_pixels=0)

    r = sampled[:, 0].astype(np.int16)
    g = sampled[:, 1].astype(np.int16)
    b = sampled[:, 2].astype(np.int16)
    grayscale_mask = (np.abs(r - g) <= channel_tolerance) & (np.abs(g - b) <= channel_tolerance)
    grayscale_ratio = float(grayscale_mask.mean())
    is_grayscale = grayscale_ratio >= grayscale_ratio_threshold
    return BWCheckResult(
        is_grayscale=is_grayscale,
        grayscale_ratio=grayscale_ratio,
        sampled_pixels=int(sampled.shape[0]),
    )
