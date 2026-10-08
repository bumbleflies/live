# live.bumbleflies.de

Login-gated sidecar app for generating `bumble:live` VDO.Ninja room links and the
matching OBS scene-collection file. Design and implementation plan: [`PLAN.md`](./PLAN.md).

Sign in with a bumbleflies.de Google account and get the 11 links (director, 3
hosts + external guest, 4+1 OBS view sources, screen share + OBS) with the hard-won
warnings inline, a scene-aware stream monitor and in-page join windows, and a download
of the patched 8-scene OBS scene collection (`03 Nico` / `04 Sebi` / `05 Chris` solo
scenes). Links are permanent, so OBS is imported once ever. Everything else — stream
key, YouTube event, profiles — stays with the bumble:live runbook.

## Stack

- **Frontend**: Vite + React 19 SPA (`src/client/`), single page, no router.
- **Backend**: Express 5 (`src/server/`), plain REST, port 3000.
- **No database.** The signed JWT (`live_token` cookie, 12h) carries auth state; the
  current room lives in one JSON file under `DATA_DIR` (default `./data`).
- **Auth**: Passport Google OAuth20 against the shared bumbleflies-only Google OAuth
  client (the Workspace configuration is the access boundary), JWT in an `httpOnly`
  cookie — same model as the `queen` app.

## Room model

Links are **permanent**: `POST /api/room` is idempotent and always returns the current
room's links (same links on every restart/deploy, so OBS is imported once ever).
Rotation is an explicit, confirmable action only:

- `POST /api/room` — current room + links (never rotates).
- `POST /api/room/rotate` — new room/password; **invalidates every previously sent
  link**; OBS then needs a one-time re-import of the freshly downloaded scene
  collection. The UI warns before and after (real modal + inline banner).
- `POST /api/scene-collection` — OBS file for the current room.

Storage: `DATA_DIR` (default `./data`), file `state.json` (atomic replace). Production
mounts a named volume (`live-data:/data`) so rotation state survives watchtower image
updates; a corrupt or missing file self-heals by generating a fresh room.

## Development

```bash
npm install
npm run dev          # vite dev server + server (tsx watch) with /api,/auth proxy
npm test             # vitest
npm run typecheck && npm run typecheck:server
npm run lint         # oxlint
npm run build        # vite build -> dist/ + tsc server -> dist/src/server/
npm start            # node dist/src/server/index.js (needs NODE_ENV=production to serve the SPA)
```

### Environment variables (server)

| Variable | Notes |
| --- | --- |
| `JWT_SECRET` | required, fail-fast at boot; fresh secret for this app (e.g. `openssl rand -hex 32`), **not** reused from queen |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | existing bumbleflies-only OAuth client, same values queen uses |
| `GOOGLE_CALLBACK_URL` | `https://live.bumbleflies.de/auth/google/callback` |
| `DATA_DIR` | room persistence dir; the image defaults to `/data` (owned by the container user, so the `live-data` volume mounts pre-owned) — unset means `./data` locally |
| `NODE_ENV` / `PORT` | `production` / `3000` in the compose env template |

Server-side access is additionally defended in code with an
`email.endsWith('@bumbleflies.de')` check — the OAuth client remains the real gate.

## Deployment

- Caches nothing; image `bumblecode/live:latest`; Docker healthcheck on `GET /health`.
- Infra side (compose block in `servyy-container/bumbleflies/docker-compose.yml`, the
  `live.env.j2` ansible template, secrets, deploy to `servyy-test.lxd` first) is
  tracked via the `dachrisch/servyy-container` issue for this app.
- **Deploy prerequisite (manual, one-time)**: add
  `https://live.bumbleflies.de/auth/google/callback` as an authorized redirect URI on
  the shared Google OAuth client in Google Cloud Console. Without it login fails with
  `redirect_uri_mismatch`. Also required once in GitHub repo settings: Docker Hub
  secrets `DOCKERHUB_USERNAME` / `DOCKER_TOKEN` (used by `master.yml` push job).

## Streaming kit & template source of truth

- `bumble-live/` — the full bumble:live host kit (runbook, checklist, OBS profiles and
  scene collection, overlays, `tools/generate-links.sh`). It moved here from the
  **bumbleflies/web** repo; this is now the single source of truth. The server imports
  `bumble-live/OBS/scene-collections/Bumbleflies-Live.json` directly, so scene changes
  must be made there, never in a copied file.
- `src/client/styles.css` — the design tokens copied from web's design system.

## Access tiers: public / guest / bumbleflies

- **Public** (root, no link): a static landing — what the show is, Google sign-in for
  bumbleflies members, and an "Open access link" field that accepts a full guest URL,
  the `#…` code fragment, or a bare `r=…&p=…` code. Zero API calls, zero room secrets.
- **Guest** (hash capability `#r=…&p=…&person=X`): anonymous personal page bound to one
  person — their own camera/publish window, the full scene monitor (watch what OBS
  sees), and the VDO.Ninja **director** for room control (mute/spot/solo). Guests
  cannot manage: rotate, OBS scene collection download and the links list stay behind
  the bumbleflies Google gate. Per-person binding is UI policy, not cryptography —
  the fragment contains everything, so handle guest links like keys; **rotating the
  room revokes every guest link**.
- **Bumbleflies** (Google session): full room management incl. guest-link creation
  ("Guest access links" section), rotate, scene collection.

The secret in guest links lives in the URL fragment, which browsers never send to the
server (no access logs, no API traffic). Guest flows make zero authenticated calls —
the bumbleflies-only OAuth client remains the sole gate to any privileged endpoint.

## Stream monitor & join windows (embedded VDO.Ninja)

The signed-in page mirrors the OBS scenarios: a **stream monitor** panel with the
8 scene modes (`All hosts equally`, `Hosts + Guest`, `Hosts + Screen`, one Focus per
person), composed in CSS from the documented solo `view=<id>&solo` links — the same
feeds OBS consumes. **Join as …** opens a publish window (the person's guest link)
right on the page; anyone signed in can go on camera without leaving the site.

Permissions: iframes use `allow="camera; microphone; display-capture; autoplay;
fullscreen"`. The "open in new tab" fallback is the escape hatch for Safari/iOS or
browser-popout restrictions; the director stays a plain link.

## Verification before first real use

1. Deploy to `servyy-test`, sign in with a real `@bumbleflies.de` account, confirm
   `/auth/me` shows the right email; confirm a non-bumbleflies Google account is
   rejected (this exercises the OAuth client restriction, the actual boundary).
2. Generate a room and compare the links against `tools/generate-links.sh` output
   (shape + warnings), including the external-guest slot.
3. Download the scene collection, import into a **test** OBS scene collection, confirm
   the four VDO.Ninja sources point at the new room and OBS imports the file cleanly.
4. Only then promote to production per the existing gated-rollout process.
