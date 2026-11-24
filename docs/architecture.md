# Architecture

## Services
| Service | Tech | Role |
|---|---|---|
| frontend | React, TypeScript, Vite, R3F | Rendering, input, UI, local simulation of nearby creatures |
| backend | Go (net/http, gorilla/websocket) | Auth, saves, discoveries, inventory, rooms, species cache |
| simulation | Python, FastAPI, NumPy | Terrain generation, boids, ecosystem model, currents |
| postgres | PostgreSQL 16 | Players, saves, expeditions, discoveries, inventory, species |
| redis | Redis 7 | Species catalogue cache; reserved for presence and rate limiting |

The browser talks only to the backend. The backend calls the simulation service.

## Frontend design
- **Pure logic is separated from rendering.** `game/physics`, `game/creatures/flocking.ts`, `sharkAI.ts`, `missions.ts`, `noise.ts` and `terrainData.ts` have no React or Three.js imports and are unit tested.
- **Per-frame state lives outside React.** `game/world.ts` holds the submarine runtime, scan targets, sonar and remote players. The HUD reads it on a timer. The Zustand store holds only slow state (inventory, journal, missions, settings) and throttled vitals at 10 Hz.
- **Instancing everywhere.** Coral (4 meshes), seaweed, fish schools, jellyfish and bubbles are `InstancedMesh`. Seaweed sway and fish tail wiggle run in the vertex shader. Marine snow wraps in the vertex shader.
- **Creature LOD.** Flock simulation rate drops with distance (every frame, every 2nd, every 4th). Creatures register scannable targets through `useTarget`.
- **Quality presets** change particle, coral, seaweed, fish and jellyfish counts and the pixel ratio. `PerformanceMonitor` lowers the preset automatically.

## Persistence
- Local: `localStorage` key `ocean-frontier-save-v1`, autosaved every 20 s and on exit.
- Server (signed in): `PUT /api/save` stores the same JSON in `saves.data` (256 KB cap). `parseSave` validates anything loaded so a corrupt save cannot crash the game.

## Multiplayer protocol
Client connects to `/ws?room=CODE&token=JWT`. Server messages: `welcome`, `join`, `leave`, `pose`, `discovery`, `chat`. Poses are rate limited to 25 Hz per client on the server, the client sends 10 Hz and interpolates. Rooms hold up to 8 players. Only other players' state is relayed, never world data.

## Asset pipeline (for when external models are added)
- Format: glTF 2.0 binary (`.glb`), Draco or Meshopt compressed, under 300 KB per creature, under 2k triangles at LOD0.
- Textures: KTX2/Basis, power-of-two, max 1024 px.
- Place files in `frontend/src/assets/models/` and load with `useGLTF`. Record the source and licence of every asset in `frontend/src/assets/LICENSES.md`. Only CC0 or CC-BY assets are acceptable.
