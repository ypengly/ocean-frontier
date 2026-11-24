"""Server-side procedural terrain. Shallow reef plateau that deepens toward +z (the trench)."""
import numpy as np
from procedural.noise import fbm

ZONES = [
    (-60.0, "reef"),
    (-120.0, "open_water"),
]


def generate_heightmap(seed: int = 1, size: int = 129, extent: float = 600.0) -> np.ndarray:
    if size < 3 or size > 513:
        raise ValueError("size must be between 3 and 513")
    half = extent / 2
    xs = np.linspace(-half, half, size)
    X, Z = np.meshgrid(xs, xs)
    base = -22.0 - np.clip((Z + 40.0) / (half + 40.0), 0, 1) ** 1.6 * 190.0
    hills = (fbm(X / 70.0, Z / 70.0, seed, 5) - 0.5) * 34.0
    dunes = (fbm(X / 14.0, Z / 14.0, seed + 7, 3) - 0.5) * 3.0
    return (base + hills + dunes).astype(np.float32)


def classify_zone(y: float) -> str:
    for limit, name in ZONES:
        if y >= limit:
            return name
    return "abyssal_trench"
