# AGENTS.md — live.bumbleflies.de

## What this repo is

Login-gated sidecar app for the bumble:live show. Signed-in bumbleflies members get
permanent VDO.Ninja room links plus a patched OBS scene-collection download; guests get
personal pages behind a `#r=…&p=…&person=…` URL-fragment capability. Vite + React 19 SPA
(`src/client/`) over an Express 5 REST API (`src/server/`, port 3000). **No database:**
state is a signed JWT `live_token` cookie (12h) plus one `state.json` under `DATA_DIR`
(default `./data`, atomic replace). The bumbleflies-only Google OAuth client is the
access boundary. See `README.md`, `PLAN.md` and `docs/plans/` for design detail.

`public/agents.md` is a public-facing agent/crawler discovery page served by the site —
it is not an instruction file for contributors.

## Build, test, verify

Node 26 (`.github/workflows/pr-tests.yml` uses `node-version: '26'`; the image uses
`node:26-alpine`). Commands from `package.json`:

- `npm ci` — install (CI); `npm run dev` — vite + `tsx watch` server with `/api`,`/auth` proxy
- `npm run lint` — oxlint
- `npm test` — vitest run; `npm run test:watch` — watch mode
- `npm run typecheck` / `npm run typecheck:server` — client / server TypeScript
- `npm run build` — `vite build` then `tsc -p tsconfig.server.json`
- `npm start` — `node dist/src/server/index.js` (set `NODE_ENV=production` to serve the SPA)

Every PR runs lint, tests and both typechecks (`pr-tests.yml`), then a Docker build, a
container healthcheck and an authenticated `POST /api/room` write check
(`build-publish.yml`). Releases are handled by release-please.

## Component guides

- [bumble-live/AGENTS.md](bumble-live/AGENTS.md) — the bumble:live host kit (runbook, OBS
  assets, overlays, link generator) and its operating rules.

## Safety policies

- Secrets: `JWT_SECRET` is required and fail-fast at boot; use a fresh value for this app
  (`openssl rand -hex 32`), never queen's. Room passwords, guest/director links and the
  YouTube stream key are secrets — send privately, never paste into chat, issues, wikis,
  logs or commits.
- Rotation is destructive: `POST /api/room/rotate` creates a new room and invalidates
  every previously issued guest link, requiring a one-time OBS re-import. Never rotate
  implicitly; `POST /api/room` is the idempotent current-room call.
- A missing or corrupt `DATA_DIR/state.json` self-heals by generating a fresh room, which
  invalidates old links — treat data loss there as a link-revocation event.
- Access control: the OAuth client is the real gate; the server's
  `email.endsWith('@bumbleflies.de')` check is defense in depth. Guest tiers make no
  authenticated calls; privileged endpoints stay behind the member session.
- Deployment: deploy to `servyy-test` first, verify with a real `@bumbleflies.de` account
  (and confirm non-members are rejected), then promote. Image `bumblecode/live:latest`,
  healthcheck `GET /health`. Redirect URI and Docker Hub secrets are one-time manual
  prerequisites.
