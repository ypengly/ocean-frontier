"""Vectorised boid flocking used for server-side simulation of distant populations."""
from dataclasses import dataclass
import numpy as np


@dataclass
class BoidParams:
    cohesion: float = 0.6
    alignment: float = 0.9
    separation: float = 1.4
    neighbor_radius: float = 8.0
    separation_radius: float = 2.5
    max_speed: float = 4.0
    flee_radius: float = 18.0


def step(pos: np.ndarray, vel: np.ndarray, dt: float, p: BoidParams, threat: np.ndarray | None = None):
    n = len(pos)
    if n == 0:
        return pos, vel
    diff = pos[None, :, :] - pos[:, None, :]  # diff[i, j] = pos[j] - pos[i]
    dist = np.linalg.norm(diff, axis=2) + 1e-9
    eye = np.eye(n, dtype=bool)
    near = (dist < p.neighbor_radius) & ~eye
    has_near = near.any(axis=1, keepdims=True)
    count = near.sum(axis=1, keepdims=True).clip(min=1)

    centroid = (near[:, :, None] * pos[None, :, :]).sum(axis=1) / count
    cohesion = np.where(has_near, centroid - pos, 0.0)
    mean_vel = (near[:, :, None] * vel[None, :, :]).sum(axis=1) / count
    alignment = np.where(has_near, mean_vel - vel, 0.0)
    close = (dist < p.separation_radius) & ~eye
    separation = -(close[:, :, None] * diff / dist[:, :, None] ** 2).sum(axis=1)

    acc = p.cohesion * cohesion + p.alignment * alignment + p.separation * separation
    if threat is not None:
        away = pos - threat[None, :]
        d = np.linalg.norm(away, axis=1, keepdims=True) + 1e-9
        acc = acc + np.where(d < p.flee_radius, away / d * (p.flee_radius - d) * 0.8, 0.0)

    vel = vel + acc * dt
    speed = np.linalg.norm(vel, axis=1, keepdims=True) + 1e-9
    vel = np.where(speed > p.max_speed, vel / speed * p.max_speed, vel)
    return pos + vel * dt, vel
