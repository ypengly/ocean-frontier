import logging
import os

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from ecosystem.model import Populations, current_at, step_populations
from terrain.heightmap import classify_zone, generate_heightmap

logging.basicConfig(level=os.getenv("LOG_LEVEL", "info").upper(), format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("simulation")

app = FastAPI(title="Ocean Frontier Simulation", version="0.1.0")

SPECIES = [
    {"id": "clownfish", "name": "Clownfish", "category": "Fish", "size": "small", "zones": ["reef"], "description": "Lives among anemones and defends a small territory."},
    {"id": "sardine", "name": "Sardine", "category": "Fish", "size": "small", "zones": ["reef"], "description": "Forms dense schools that scatter from predators."},
    {"id": "jellyfish", "name": "Moon Jellyfish", "category": "Cnidarian", "size": "small", "zones": ["reef"], "description": "Drifts with the current and pulses to hold depth."},
    {"id": "sea_turtle", "name": "Green Sea Turtle", "category": "Reptile", "size": "medium", "zones": ["reef"], "description": "Grazes seagrass and returns to the same reef each season."},
    {"id": "reef_shark", "name": "Blacktip Reef Shark", "category": "Fish", "size": "medium", "zones": ["reef"], "description": "Curious about unfamiliar objects; circles before leaving."},
]


@app.get("/health")
def health():
    return {"status": "ok", "service": "simulation"}


@app.get("/species")
def species():
    return SPECIES


@app.get("/terrain")
def terrain(seed: int = 1, size: int = Query(65, ge=3, le=257)):
    hm = generate_heightmap(seed=seed, size=size)
    return {"seed": seed, "size": size, "extent": 600.0, "heights": np.round(hm, 2).tolist()}


@app.get("/zone")
def zone(y: float):
    return {"zone": classify_zone(y)}


@app.get("/current")
def current(x: float, y: float, z: float, t: float = 0.0):
    vx, vy, vz = current_at(x, y, z, t)
    return {"x": vx, "y": vy, "z": vz}


class EcoState(BaseModel):
    plankton: float = Field(ge=0, le=1e6)
    small_fish: float = Field(ge=0, le=1e6)
    predators: float = Field(ge=0, le=1e6)
    steps: int = Field(default=1, ge=1, le=1000)


@app.post("/ecosystem/step")
def ecosystem_step(body: EcoState):
    p = Populations(body.plankton, body.small_fish, body.predators)
    try:
        for _ in range(body.steps):
            p = step_populations(p)
    except OverflowError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"plankton": p.plankton, "small_fish": p.small_fish, "predators": p.predators}
