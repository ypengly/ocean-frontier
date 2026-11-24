"""Population dynamics (Lotka-Volterra with logistic plankton growth) and ocean currents."""
from dataclasses import dataclass
import math


@dataclass
class Populations:
    plankton: float
    small_fish: float
    predators: float


def step_populations(p: Populations, dt: float = 1.0) -> Populations:
    k_plankton = 1000.0
    plankton_growth = 0.8 * p.plankton * (1 - p.plankton / k_plankton)
    grazing = 0.002 * p.small_fish * p.plankton
    fish_delta = 0.0006 * p.small_fish * p.plankton - 0.2 * p.small_fish - 0.01 * p.predators * p.small_fish
    pred_delta = 0.004 * p.predators * p.small_fish - 0.25 * p.predators
    return Populations(
        plankton=max(0.0, p.plankton + (plankton_growth - grazing) * dt),
        small_fish=max(0.0, p.small_fish + fish_delta * dt),
        predators=max(0.0, p.predators + pred_delta * dt),
    )


def current_at(x: float, y: float, z: float, t: float) -> tuple[float, float, float]:
    """Smooth current field; strength fades with depth (y is negative below the surface)."""
    fade = math.exp(y / 120.0)
    cx = math.sin(z * 0.011 + t * 0.07) * 0.35 + 0.1
    cz = math.cos(x * 0.009 - t * 0.05) * 0.3
    return (cx * fade, math.sin(t * 0.1 + x * 0.02) * 0.03 * fade, cz * fade)
