# 🌊 Ocean Frontier: The Lost Abyss

<div align="center">

![React](https://img.shields.io/badge/React-R3F-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-3D-black?style=for-the-badge&logo=three.js&logoColor=white)
![Go](https://img.shields.io/badge/Go-Backend-00ADD8?style=for-the-badge&logo=go&logoColor=white)
![Python](https://img.shields.io/badge/Python-Simulation-3776AB?style=for-the-badge&logo=python&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Vertical Slice](https://img.shields.io/badge/Status-Vertical_Slice-FFA500?style=for-the-badge)

**A browser-based 3D underwater exploration game.**

*Pilot a submarine · Scan creatures · Ping the seabed · Collect resources · Upgrade your sub · Survive the depth*

[🚀 Quick Start](#-quick-start) • [🎮 Controls](#-controls) • [✅ What's Built](#-built-and-wired-together) • [⚠️ What's Not](#-not-built-yet) • [🏗️ Architecture](#-project-layout)

</div>

---

## 📖 Overview

**Ocean Frontier: The Lost Abyss** is a **browser-based 3D underwater exploration game**.

### Core Idea

> **A vertical slice — plus the first pass through every roadmap phase.**
>
> **Pilot a submarine through a coral reef, scan creatures, ping the seabed with sonar, collect resources, upgrade your sub, and survive the depth.**

### The Dive Loop

```mermaid
flowchart LR
    Dive["🤿 Dive<br/>from the surface"] --> Explore["🧭 Explore<br/>coral reef"]
    Explore --> Sonar["📡 Sonar ping<br/>reveal hidden sites"]
    Explore --> Scan["🔍 Scan<br/>creatures"]
    Explore --> Collect["⛏️ Collect<br/>resources"]
    Sonar --> Discover["✨ Discover<br/>hidden sites"]
    Scan --> Journal["📓 Journal<br/>encyclopedia"]
    Collect --> Inventory["🎒 Inventory<br/>weight capacity"]
    Inventory --> Upgrade["⬆️ Workshop<br/>6 upgrade tracks"]
    Journal --> Missions["📋 Missions<br/>with rewards"]
    Missions --> Upgrade
    Upgrade --> Dive

    style Dive fill:#61DAFB,color:#000
    style Explore fill:#0EA5E9,color:#fff
    style Sonar fill:#8B5CF6,color:#fff
    style Scan fill:#22C55E,color:#fff
    style Collect fill:#FFB454,color:#000
    style Discover fill:#FFD700,color:#000
    style Journal fill:#FF3F9E,color:#fff
    style Inventory fill:#4CAF50,color:#fff
    style Upgrade fill:#0f3460,color:#fff
    style Missions fill:#FF6B6B,color:#fff
```

---

## 🚀 Quick Start

### 🐳 Everything with Docker

```bash
cp .env.example .env        # then change JWT_SECRET and the database password
docker compose up --build
```

<div align="center">

| Service | URL |
|:-------:|-----|
| **Game** | http://localhost:5173 |
| **Backend health** | http://localhost:8080/health *(reports postgres, redis, and simulation)* |
| **Simulation API docs** | http://localhost:8000/docs |

</div>

### 🖥️ Frontend Only *(Single-Player, No Backend)*

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

> 💡 **Single-player saves to your browser.**
>
> **Accounts, server saves, and multiplayer need the backend.**

### ⚙️ Run Services Separately

**Postgres + Redis + simulation via compose, backend locally:**

```bash
docker compose up postgres redis simulation

cd backend
export DATABASE_URL="postgres://ocean:ocean_dev_password@localhost:5432/ocean_frontier?sslmode=disable"
export JWT_SECRET="a-long-random-development-secret"
export MIGRATIONS_DIR=../database/migrations
export SEEDS_DIR=../database/seeds
export SIMULATION_URL=http://localhost:8000
export REDIS_URL=redis://localhost:6379/0
go mod tidy && go run ./cmd/server
```

**Simulation locally:**

```bash
cd simulation
pip install -r requirements.txt
uvicorn api.main:app --port 8000
```

### 🧪 Tests

```bash
cd frontend && npm test          # physics, vitals, flocking, shark AI, missions
cd simulation && pytest          # terrain, boids, ecosystem
cd backend && go test ./...      # auth
```

---

## 🎮 Controls

<div align="center">

| Key | Action |
|:---:|--------|
| **W / S** | **Thrust forward / reverse** |
| **A / D** | **Turn left / right** |
| **Space / C** *(or Shift)* | **Ascend / descend** |
| **Q** | **Sonar ping** |
| **E** *(hold)* | **Scan creature or collect resource** |
| **F** | **Headlights** |
| **X** | **Repair hull and engine** *(costs 1 copper)* |
| **J / I / K / U / M** | **Journal · Inventory · Missions · Workshop · Map** |
| **Esc** | **Pause or close a panel** |

</div>

---

## ✅ Built and Wired Together

<div align="center">

| 🚢 Submarine Physics | 🫧 Survival Systems |
|:---:|:---:|
| **Thrust · quadratic drag · inertia · slight positive buoyancy · emergency ascent when power dies · currents · seabed collision damage** · **three classes** *(Explorer, Deep Diver, Research)* with distinct hulls and stats | **Oxygen with an emergency reserve** · **battery** · **engine temperature and overheating** · **hull damage from depth and impacts** · **surface recharge · repair · failure and respawn** with a fair penalty |
| **🌊 Environment** | **🐠 Creatures** |
| **Procedural seabed with caustics** · **depth-based fog and color** · **sun shafts** · **marine snow** · **bubbles** · **animated seaweed** · **four instanced coral types** · **quality presets** · **adaptive quality** | **Schooling sardines and clownfish** that scatter from the sub · **a reef shark** that investigates, circles, and leaves · **turtles** on reef loops · **current-drifting jellyfish** · **distant schools simulated at a lower rate** |
| **🧭 Exploration** | **📈 Progression** |
| **Sonar ping** with expanding ring and fading contacts · **hidden sites revealed by sonar** · **scanner** · **journal** · **creature encyclopedia** · **map** | **Inventory with weight capacity** · **six upgrade tracks** · **six missions with rewards** |
| **⚙️ Backend** | **🧠 Simulation Service** |
| **Go REST API** with JWT auth · **migrations and seeds** · **saves** · **expeditions** · **discoveries** · **inventory** · **Redis-cached species proxy** · **WebSocket expedition rooms** *(pose sync, discovery sharing, chat protocol)* | **NumPy terrain** · **vectorized boids** · **population dynamics** · **current field** |
| **🔊 Procedural Audio** | |
| **Engine · sonar · alarms · bubbles · whale calls · UI** — **no audio files** | |

</div>

---

## ⚠️ Not Built Yet

> **These are stated honestly — not faked.**

<div align="center">

| Area | Details |
|:----:|---------|
| **🗺️ Zones B–E** | **Ship Graveyard · Lost City · Abyssal Trench creatures and gameplay · Arctic** — **listed in `game/constants.ts` as planned.** **The seabed deepens into a trench, but it has no trench creatures, rare resources, or pressure set pieces.** **One wreck exists inside the reef.** |
| **🐙 Missing creatures** | **Stingrays · seahorses · crabs · barracuda · octopus · whales · whale sharks · giant squid · all deep-sea species.** **Predator hunting and migration are not implemented.** |
| **👥 Multiplayer gaps** | **No chat UI, no shared mission state, no player research bases** — **the server already relays chat messages** |
| **🌍 Terrain mismatch** | **The frontend terrain is generated locally.** **The simulation service has its own terrain endpoint, but the two noise functions are not byte-identical** — **so the client does not use the server terrain yet** |
| **🚢 Wreckage and weather** | **Ships · aircraft wreckage · containers · ice · underwater storms** — **not modelled** · **shadows are off for performance** |
| **🎨 Asset pipeline** | **Models are procedural primitives** — **there is no external asset pipeline yet** *(see `docs/architecture.md`)* |

</div>

### 🧪 Verification Status

<div align="center">

| Layer | Status |
|:-----:|:------:|
| **Pure game logic** — physics, vitals, flocking, shark AI, missions | ✅ **Passing unit tests** |
| **Python simulation** | ✅ **Passing unit tests** |
| **React / Three.js frontend** | ⚠️ **Written without being compiled or run in this environment** *(no network access)* |
| **Go backend** | ⚠️ **Written without being compiled or run in this environment** *(no Go toolchain)* |
| **Docker images** | ⚠️ **Written without being compiled or run in this environment** |
| **Visual tuning** — light intensities, fog density | ⚠️ **Never seen on screen — likely needs adjusting** |

</div>

> ⚠️ **Expect to fix a few type errors or compile errors on first build.**
>
> **Run `npm run typecheck` and `go vet ./...` first.**

---

## 🏗️ Project Layout

```
ocean-frontier/
├── frontend/                 React + R3F game client
│   └── src/
│       ├── game/             game logic
│       ├── ui/               UI components
│       ├── stores/           Zustand state
│       ├── hooks/            custom React hooks
│       ├── audio/            procedural audio
│       └── api/              API client
│
├── backend/                  Go API + WebSocket hub
│   ├── cmd/server/           entry point
│   └── internal/*            packages
│
├── simulation/               Python FastAPI simulation
│                             terrain · creatures · ecosystem
│                             procedural · api
│
├── database/                 SQL migrations and seeds
│
├── infrastructure/
│   └── docker/               Dockerfiles
│
└── docs/                     architecture · API · game design
```

### System Overview

```mermaid
flowchart TB
    subgraph CLIENT["🖥️ Frontend (React + R3F)"]
        Game["game/<br/>submarine physics · creatures<br/>environment · exploration"]
        UI["ui/<br/>HUD · panels · map"]
        Stores["stores/<br/>Zustand"]
        Audio["audio/<br/>procedural"]
    end

    subgraph BACKEND["⚙️ Backend (Go)"]
        REST["REST API<br/>JWT auth · saves<br/>expeditions · discoveries"]
        WS["WebSocket hub<br/>pose sync · chat"]
        Cache["Redis<br/>species cache"]
    end

    subgraph SIM["🧠 Simulation (Python)"]
        Terrain["NumPy terrain"]
        Boids["Vectorized boids"]
        Ecosystem["Population dynamics"]
        Currents["Current field"]
    end

    subgraph DATA["🗄️ Data"]
        Postgres[("PostgreSQL<br/>migrations + seeds")]
        Redis[("Redis")]
    end

    CLIENT --> BACKEND
    BACKEND --> DATA
    BACKEND --> SIM
    SIM --> DATA

    style CLIENT fill:#61DAFB,color:#000
    style BACKEND fill:#00ADD8,color:#fff
    style SIM fill:#3776AB,color:#fff
    style DATA fill:#316192,color:#fff
```

### Design Principles

<div align="center">

| Principle | Implementation |
|:---------:|---------------|
| **🔬 Vertical slice first** | **Every roadmap phase has a first pass** — **so the whole architecture is proven, not just the easy parts** |
| **⚛️ Physics feels real** | **Quadratic drag · inertia · positive buoyancy · currents** — **not scripted motion** |
| **🌊 Environment changes with depth** | **Depth-based fog and color** — **the abyss feels different because it looks different** |
| **🐟 Creatures behave** | **Schooling, scattering, investigating, circling** — **each species has its own logic** |
| **🎯 Distant simulation is cheaper** | **Distant schools are simulated at a lower rate** |
| **🔊 Audio without assets** | **Engine · sonar · alarms · bubbles · whale calls · UI** — **all synthesized** |
| **📊 Quality is adaptive** | **Presets plus automatic scaling** |
| **🚫 Honest about what's missing** | **Zones B–E, missing creatures, multiplayer gaps, and terrain mismatch are all documented** |
| **🧪 Pure logic is tested** | **Physics, vitals, flocking, shark AI, and missions all have passing tests** |

</div>

---

## 🗺️ Roadmap

### ✅ Current

- [x] Submarine physics with thrust, quadratic drag, inertia, buoyancy, emergency ascent, currents, and seabed collision damage
- [x] Three submarine classes — Explorer, Deep Diver, Research
- [x] Survival systems — oxygen with emergency reserve, battery, engine temperature and overheating, hull damage, surface recharge, repair, failure and respawn
- [x] Procedural seabed with caustics, depth-based fog and color, sun shafts, marine snow, bubbles, animated seaweed, four instanced coral types
- [x] Quality presets and adaptive quality
- [x] Schooling sardines and clownfish that scatter
- [x] Reef shark that investigates, circles, and leaves
- [x] Turtles on reef loops
- [x] Current-drifting jellyfish
- [x] Distant schools simulated at a lower rate
- [x] Sonar ping with expanding ring and fading contacts
- [x] Hidden sites revealed by sonar
- [x] Scanner, journal, creature encyclopedia, and map
- [x] Inventory with weight capacity
- [x] Six upgrade tracks
- [x] Six missions with rewards
- [x] Go REST API with JWT auth
- [x] Database migrations and seeds
- [x] Server-side saves, expeditions, discoveries, and inventory
- [x] Redis-cached species proxy
- [x] WebSocket expedition rooms with pose sync, discovery sharing, and chat protocol
- [x] Python simulation service — NumPy terrain, vectorized boids, population dynamics, current field
- [x] Fully procedural audio — engine, sonar, alarms, bubbles, whale calls, UI
- [x] Frontend-only single-player mode with browser saves
- [x] Docker Compose setup for full-stack deployment
- [x] Health endpoint reporting postgres, redis, and simulation
- [x] Unit tests for frontend game logic and Python simulation
- [x] Go auth tests
- [x] `docs/architecture.md` with design notes
- [x] Honest verification status documented

### 🔜 Future Ideas

- [ ] **Zones B–E** — Ship Graveyard, Lost City, Abyssal Trench creatures and gameplay, Arctic
- [ ] **Remaining creatures** — stingrays, seahorses, crabs, barracuda, octopus, whales, whale sharks, giant squid, deep-sea species
- [ ] **Predator hunting and migration**
- [ ] **Multiplayer chat UI, shared mission state, and player research bases**
- [ ] **Unified terrain** — the client should consume the simulation service's terrain instead of generating its own
- [ ] **Ship and aircraft wreckage, containers, ice, underwater storms**
- [ ] **Shadows** — currently off for performance
- [ ] **External asset pipeline** — beyond the current procedural primitives
- [ ] **Verified first build** — `npm run typecheck`, `go vet ./...`, Docker builds
- [ ] **Visual tuning** — light intensities and fog density have never been seen on screen

---

## 🤝 Contributing

Contributions are welcome. Please:

1. Fork the repository
2. **Keep the physics real** — quadratic drag, inertia, and buoyancy must stay
3. **Keep the environment depth-aware** — fog and color must change with depth
4. **Keep creature behavior species-specific** — no generic wandering
5. **Keep distant simulation cheaper** — lower rate for distant schools
6. **Keep audio procedural** — no audio files
7. **Preserve the honesty contract** — the **Not Built Yet** section is the standard
8. **Report build errors you fix** — the frontend and backend haven't been compiled in the authoring environment
9. **Add tests for any new mechanic** — pure logic is the tested layer
10. Submit a Pull Request

### Guidelines

- **Never claim a feature is built** when the roadmap says otherwise
- **Never fake creature behavior** — each species should have its own logic
- **Never break the physics model** — the submarine feel depends on it
- **Never present a stub as a feature**
- **Never ship visual tuning that hasn't been seen on screen**

---

## 📜 License

MIT — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **Three.js and React Three Fiber** — for making an underwater world this immersive
- **NumPy** — for vectorized boids that keep the simulation fast
- **Go** — for a backend that stays out of the way
- **Every explorer who's ever looked down and wondered how deep it goes** — this one's for you

---

<div align="center">

### 🌊 DIVE. SCAN. DISCOVER. SURVIVE.

**A browser-based 3D underwater exploration game.**

**Vertical slice — plus the first pass through every roadmap phase.**

<br>

> ⚠️ **Frontend and backend written without being compiled. Visual tuning never seen on screen.**

<br>

⭐ If Ocean Frontier took you into the abyss, consider giving it a star.

<br>

[⬆ Back to Top](#-ocean-frontier-the-lost-abyss)

</div>
