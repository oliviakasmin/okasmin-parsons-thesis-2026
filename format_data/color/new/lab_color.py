"""sRGB (uint8) to CIE L*a*b* (D65 illuminant), numpy-only."""

from __future__ import annotations

import numpy as np

# D65 reference white (normalized so Yn = 1)
_XN = 0.950_47
_YN = 1.0
_ZN = 1.088_83

# sRGB D65 RGB → XYZ (column-vector convention)
_M = np.array(
    [
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041],
    ],
    dtype=np.float64,
)


def _srgb_channel_to_linear(channel: np.ndarray) -> np.ndarray:
    u = np.clip(channel.astype(np.float64) / 255.0, 0.0, 1.0)
    return np.where(u <= 0.04045, u / 12.92, ((u + 0.055) / 1.055) ** 2.4)


def rgb_uint8_to_xyz(rgb: tuple[int, int, int] | np.ndarray) -> tuple[float, float, float]:
    r, g, b = (int(rgb[0]), int(rgb[1]), int(rgb[2]))
    lin = _srgb_channel_to_linear(np.array([r, g, b], dtype=np.float64))
    xyz = _M @ lin
    return float(xyz[0]), float(xyz[1]), float(xyz[2])


def _f_lab(t: np.ndarray) -> np.ndarray:
    delta = 6.0 / 29.0
    t = np.asarray(t, dtype=np.float64)
    return np.where(t > delta**3, np.cbrt(t), t / (3.0 * delta**2) + 4.0 / 29.0)


def xyz_to_lab(x: float, y: float, z: float) -> tuple[float, float, float]:
    """CIE L*a*b* from XYZ (D65). Clips negative XYZ to small epsilon."""
    x = max(x, 1e-10)
    y = max(y, 1e-10)
    z = max(z, 1e-10)
    fx, fy, fz = _f_lab(np.array([x / _XN, y / _YN, z / _ZN]))
    L = 116.0 * fy - 16.0
    a_star = 500.0 * (fx - fy)
    b_star = 200.0 * (fy - fz)
    return float(L), float(a_star), float(b_star)


def rgb_uint8_to_lab(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    x, y, z = rgb_uint8_to_xyz(rgb)
    return xyz_to_lab(x, y, z)


def chroma_from_ab(a: float, b: float) -> float:
    return float(np.hypot(a, b))
