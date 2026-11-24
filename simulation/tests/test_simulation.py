import numpy as np

from creatures.boids import BoidParams, step
from ecosystem.model import Populations, step_populations
from terrain.heightmap import classify_zone, generate_heightmap


def test_heightmap_deterministic_and_deepens():
    a = generate_heightmap(seed=3, size=33)
    b = generate_heightmap(seed=3, size=33)
    assert np.array_equal(a, b)
    assert a[-1].mean() < a[0].mean()  # trench side (+z) is deeper


def test_zone_classification():
    assert classify_zone(-20) == "reef"
    assert classify_zone(-90) == "open_water"
    assert classify_zone(-200) == "abyssal_trench"


def test_boids_flee_threat():
    rng = np.random.default_rng(0)
    pos = rng.normal(0, 2, (20, 3))
    vel = np.zeros((20, 3))
    threat = np.array([0.0, 0.0, 0.0])
    d0 = np.linalg.norm(pos - threat, axis=1).mean()
    for _ in range(40):
        pos, vel = step(pos, vel, 0.1, BoidParams(), threat)
    assert np.linalg.norm(pos - threat, axis=1).mean() > d0


def test_populations_non_negative():
    p = Populations(500, 100, 5)
    for _ in range(200):
        p = step_populations(p)
        assert min(p.plankton, p.small_fish, p.predators) >= 0
