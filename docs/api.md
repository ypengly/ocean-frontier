# API

Base URL `http://localhost:8080`. JSON everywhere. Errors: `{"error": "message"}`. Authenticated routes need `Authorization: Bearer <token>`.

| Method | Path | Auth | Body / notes |
|---|---|---|---|
| GET | /health | no | `{backend, postgres, redis, simulation}`, 503 if any is down |
| POST | /api/auth/register | no | `{username, password}`, username 3-24 `[A-Za-z0-9_]`, password 8-72. 201, 409 if taken |
| POST | /api/auth/login | no | `{username, password}` returns `{token, playerId, username}` |
| GET | /api/save | yes | `{version, data}` or 404 |
| PUT | /api/save | yes | `{version, data}`, data valid JSON under 256 KB |
| POST | /api/expeditions | yes | `{zone, submarine}` returns `{expeditionId}` |
| POST | /api/discoveries | yes | `{expeditionId?, targetId, name, category, zone, depth}`; duplicates ignored |
| GET | /api/discoveries | yes | Latest 500 for the player |
| GET | /api/inventory | yes | `[{itemId, quantity}]` |
| PUT | /api/inventory | yes | Replaces inventory; item ids `[a-z_]{2,32}`, quantity 0-100000 |
| GET | /api/sim/species | no | Cached 5 min in Redis |
| GET | /api/sim/terrain?seed&size | no | Heightmap from the simulation service |
| WS | /ws?room&token | yes | See architecture.md |

Simulation service (port 8000): `GET /health`, `/species`, `/terrain?seed&size`, `/zone?y`, `/current?x&y&z&t`, `POST /ecosystem/step`. Interactive docs at `/docs`.
