# live.bumbleflies.de

Login-gated sidecar app for generating `bumble:live` VDO.Ninja room links and the
matching OBS scene-collection file. Design and implementation plan: [`PLAN.md`](./PLAN.md).

Sign in with a bumbleflies.de Google account, click **Generate new room**, get the
9 links (director, 3 guests, 3 OBS view sources, screen-share guest + OBS) with the
hard-won warnings inline, and download the patched 8-scene OBS scene collection
(`03 Nico` / `04 Sebi` / `05 Chris` solo scenes). Everything else — stream key,
YouTube event, profiles — stays with the bumble:live runbook.

## Stack

- **Frontend**: Vite + React 19 SPA (`src/client/`), single page, no router.
- **Backend**: Express 5 (`src/server/`), plain REST, port 3000.
- **No database.** The signed JWT (`live_token` cookie, 12h) carries everything; the
  last generated room per user lives in memory only.
- **Auth**: Passport Google OAuth20 against the shared bumbleflies-only Google OAuth
  client (the Workspace configuration is the access boundary), JWT in an `httpOnly`
  cookie — same model as the `queen` app.

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

## Vendored files (re-copy by hand if the source changes)

- `src/server/assets/scene-collections/Bumbleflies-Live.json` — copy of
  `bumble-live/OBS/scene-collections/` in the **bumbleflies/web** repo (the
  restructured 8-scene template with the solo scenes). The app deliberately does not
  depend on the web repo at build time; if the scene layout changes there again,
  re-copy this file and adjust the `view=`/push-id mapping only if source names
  change.
- `src/client/styles.css` — the design tokens copied from `web/beta`'s design system.

## Verification before first real use

1. Deploy to `servyy-test`, sign in with a real `@bumbleflies.de` account, confirm
   `/auth/me` shows the right email; confirm a non-bumbleflies Google account is
   rejected (this exercises the OAuth client restriction, the actual boundary).
2. Generate a room and compare the 9 links against `tools/generate-links.sh` output
   (shape + warnings).
3. Download the scene collection, import into a **test** OBS scene collection, confirm
   the four VDO.Ninja sources point at the new room and OBS imports the file cleanly.
4. Only then promote to production per the existing gated-rollout process.
