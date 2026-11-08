# homelab-hub
Custom Node.js hub for managing homelab services. Features Pterodactyl/Pelican API integration and secure, modular hosting for web tools.

## Setup
Requires Node.js >= 20.

```
npm install
# create .env (see below)
npm start
```

The server exits at startup if `.env` is missing or `ADMIN_PASS` is shorter than 8 characters. Default port is `40404`.

## Configuration (`.env`)
| Variable | Required | Purpose |
|----------|----------|---------|
| `ADMIN_PASS` | yes (min. 8 chars) | Admin password for write actions |
| `SESSION_SECRET` | recommended | Salt for the session cookie (a warning is logged when unset) |
| `SERVER_PORT` | no | Listen port (default `40404`) |
| `UPTIME_KUMA_URL`, `UPTIME_KUMA_SLUG` | no | Uptime Kuma status page shown on the home page |
| `CONTROL_PANEL_URL`, `CONTROL_PANEL_KEY`, `PANEL_GAME_SERVER_TAG` | no | Pterodactyl/Pelican panel (game server status) |
| `YT_WORKER_URL`, `YT_WORKER_KEY` | no | External worker behind YT-Sync |
| `CURSEFORGE_API_KEY` | no | CurseForge lookups in the Mod Compat Checker |

Optional integrations are skipped when their variables are empty.

## Operations
- Health check: `GET /healthz` returns `{"status":"ok","uptime":<seconds>}` (suitable for an Uptime Kuma HTTP monitor).
- Shuts down gracefully on `SIGTERM` / `SIGINT`.
- Runtime data (Fabula Ultima saves, quiz sets) lives in `public/data/` and is not tracked by git - back it up separately.
