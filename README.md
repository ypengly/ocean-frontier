# Ocean Frontier: The Lost Abyss

A browser-based 3D underwater exploration game. Pilot a submarine through a coral reef, scan creatures, ping the seabed with sonar, collect resources, upgrade your sub and survive the depth.

This repository is the **vertical slice plus the first pass through every roadmap phase**. The status table below says exactly what is finished and what is not.

## Quick start

### Everything with Docker
```bash
cp .env.example .env        # then change JWT_SECRET and the database password
docker compose up --build
```
- Game: http://localhost:5173
- Backend health: http://localhost:8080/health (reports postgres, redis and simulation)
- Simulation API docs: http://localhost:8000/docs

### Frontend only (single-player, no backend)
```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```
Single-player saves to your browser. Accounts, server saves and multiplayer need the backend.

### Run services separately
```bash
# Postgres + Redis + simulation via compose, backend locally:
docker compose up postgres redis simulation
cd backend
export DATABASE_URL="postgres://ocean:ocean_dev_password@localhost:5432/ocean_frontier?sslmode=disable"
export JWT_SECRET="a-long-random-development-secret"
export MIGRATIONS_DIR=../database/migrations SEEDS_DIR=../database/seeds
export SIMULATION_URL=http://localhost:8000 REDIS_URL=redis://localhost:6379/0
go mod tidy && go run ./cmd/server

# Simulation locally
cd simulation && pip install -r requirements.txt && uvicorn api.main:app --port 8000
```

### Tests
```bash
cd frontend && npm test          # physics, vitals, flocking, shark AI, missions
cd simulation && pytest          # terrain, boids, ecosystem
cd backend && go test ./...      # auth
```

## Controls
| Key | Action |
|---|---|
| W / S | Thrust forward / reverse |
| A / D | Turn left / right |
| Space / C (or Shift) | Ascend / descend |
| Q | Sonar ping |
| E (hold) | Scan creature or collect resource |
| F | Headlights |
| X | Repair hull and engine (costs 1 copper) |
| J / I / K / U / M | Journal, inventory, missions, workshop, map |
| Esc | Pause or close a panel |

## Status: what is and is not built

**Built and wired together**
- Submarine physics: thrust, quadratic drag, inertia, slight positive buoyancy, emergency ascent when power dies, currents, seabed collision damage. Three classes (Explorer, Deep Diver, Research) with distinct hulls and stats.
- Survival: oxygen with an emergency reserve, battery, engine temperature and overheating, hull damage from depth and impacts, surface recharge, repair, failure and respawn with a fair penalty.
- Environment: procedural seabed with caustics, depth-based fog and colour, sun shafts, marine snow, bubbles, animated seaweed, four instanced coral types, quality presets and adaptive quality.
- Creatures: schooling sardines and clownfish that scatter from the sub, a reef shark that investigates, circles and leaves, turtles on reef loops, current-drifting jellyfish. Distant schools are simulated at a lower rate.
- Exploration: sonar ping with expanding ring and fading contacts, hidden sites revealed by sonar, scanner, journal, creature encyclopedia, map.
- Progression: inventory with weight capacity, six upgrade tracks, six missions with rewards.
- Backend: Go REST API with JWT auth, migrations and seeds, saves, expeditions, discoveries, inventory, Redis-cached species proxy, WebSocket expedition rooms (pose sync, discovery sharing, chat protocol).
- Simulation service: NumPy terrain, vectorised boids, population dynamics, current field.
- Procedural audio (engine, sonar, alarms, bubbles, whale calls, UI) with no audio files.

**Not built yet**
- Zones B to E (Ship Graveyard, Lost City, Abyssal Trench creatures and gameplay, Arctic) are listed in `game/constants.ts` as planned. The seabed does deepen into a trench, but it has no trench creatures, rare resources or pressure set pieces. One wreck exists inside the reef.
- Creatures from the spec not implemented: stingrays, seahorses, crabs, barracuda, octopus, whales, whale sharks, giant squid and all deep-sea species. Predator hunting and migration are not implemented.
- Multiplayer has no chat UI, no shared mission state and no player research bases (the server already relays chat messages).
- The frontend terrain is generated locally. The simulation service has its own terrain endpoint, but the two noise functions are not byte-identical, so the client does not use the server terrain yet.
- Ships and aircraft wreckage, containers, ice and underwater storms are not modelled. Shadows are off for performance.
- Models are procedural primitives. There is no external asset pipeline yet (see `docs/architecture.md`).

**Verification status.** The pure game logic (physics, vitals, flocking, shark AI, missions) and the Python simulation have passing unit tests. The React/Three.js code, the Go backend and the Docker images were written without being compiled or run in this environment (no network access or Go toolchain), so expect to fix a few type errors or compile errors on first build. Run `npm run typecheck` and `go vet ./...` first. Visual tuning (light intensities, fog density) has never been seen on screen and will likely need adjusting.

## Project layout
```
frontend/    React + R3F game client (src/game, src/ui, src/stores, src/hooks, src/audio, src/api)
backend/     Go API + WebSocket hub (cmd/server, internal/*)
simulation/  Python FastAPI simulation (terrain, creatures, ecosystem, procedural, api)
database/    SQL migrations and seeds
infrastructure/docker/  Dockerfiles
docs/        architecture, API, game design
```
