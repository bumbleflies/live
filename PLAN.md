# `live.bumbleflies.de` — a login-gated sidecar app for bumble:live room setup

## Context

Over this session we built out `bumble-live/` (in the `bumbleflies/web` repo): a CLI tool
(`tools/generate-links.sh`) that generates the 9 VDO.Ninja links needed for a session
(director, 3 guest camera links, 3 OBS view links, screen-share guest + view link) and,
when run locally with OBS closed, patches the real OBS scene collection file on disk so
the `Nico`/`Sebi`/`Chris`/`Screen` Browser Sources already point at the new room.

This works, but it's a local-only CLI step the host has to run from a terminal before
every session. The user wants this turned into a small, login-gated web app ("sidecar
app"), linked from the bumbleflies.de homepage, so generating a room and getting the
OBS setup is a login + click away rather than a terminal command. Login should restrict
access to bumbleflies org members, the same way the existing `queen` app does it.

**Research already done (do not re-derive, just reuse):**
- `queen` (`/home/cda/dev/infrastructure/bumbleflies/queen`) is the auth model to copy:
  Google OAuth (`passport-google-oauth20`) against the **existing bumbleflies-only
  Google OAuth client** (the org-restriction boundary is the OAuth client's own Google
  Workspace configuration, not an in-app domain check), then a signed JWT in an
  `httpOnly` cookie. See `queen/src/server/routes/auth.ts` (full route/middleware code)
  and `queen/src/server/services/AuthService.ts` (`signToken`/`verifyToken`/`isAdmin`).
  The OAuth client credentials are **reused** across bumbleflies apps via env vars
  (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`), not a shared
  library — see `container/ansible/plays/roles/docker_service/templates/finance/queen.env.j2`.
- Deployment convention: new bumbleflies subdomains get a new service block in the
  **existing** `container/bumbleflies/docker-compose.yml` (see the `edu`/`bnb` blocks
  there for the exact Traefik label shape: `Host(\`<name>.bumbleflies.de\`)`,
  `certresolver=letsencrypthttpresolver` — `bumbleflies.de` is on GoDaddy DNS so HTTP-01
  is required, not the DNS-01 resolver other domains use). `queen` deviates into its own
  `container/finance/docker-compose.yml` grouping only because it shares a Mongo/Redis
  backend with the Firefly III finance stack — this new app needs no such shared backend,
  so it belongs in the shared `bumbleflies/docker-compose.yml` like `edu`/`bnb`, just
  running a live Node process (port 3000, like queen) instead of static nginx.
- The `bootstrapping-bumbleflies-subdomain` skill (`container/.claude/skills/bootstrapping-bumbleflies-subdomain/SKILL.md`)
  covers repo creation (`gh repo create bumbleflies/<name>`, `git init -b master`, org
  convention — `main` breaks CI/deploy lookups), but is written for static Astro sites.
  Follow its repo/CI steps, but swap the static Dockerfile/nginx step for queen's
  Node-server Dockerfile shape (multi-stage `node:24-alpine` builder → `node:24-alpine`
  runtime, `USER node`, `HEALTHCHECK` on `GET /health`, port 3000, see `queen/Dockerfile`).
- CI shape: `web`'s `.github/workflows/astro-build-deploy.yml` → `build.yml` (build +
  export image as a `.tar` artifact) → `test.yml` + `test-image.yml` → `part_deploy_astro.yml`
  (push to `docker.io/bumblecode/<name>`, deploy job only on `master` + success). Copy this
  shape (queen's own workflow set follows the same build→test→push pattern, just add a
  `release-please` layer if versioned releases are wanted — not required for v1).

**User decisions from this planning session:**
- OBS output is a **downloadable scene-collection JSON**, not a direct local file write
  (the app runs on a server, it cannot reach into the host machine's
  `~/.config/obs-studio/...`). The host still does one manual step: OBS's own
  Scene Collection > Import. This keeps the same human-in-the-loop safety as today,
  just removes the manual URL-pasting and the need to run a local script.
- "profile" in the user's request means the OBS scene collection/Browser Source setup
  (the thing `generate-links.sh` already patches), not the YouTube channel's own
  Kanalanpassung branding (banner/watermark/description) — that's out of scope.
- App name/subdomain: **`live.bumbleflies.de`**, repo **`bumbleflies/live`** (created
  public, matching `queen`/`edu` convention).

## Design

### Repo & scaffolding
New repo `bumbleflies/live` (public, matching org convention), `git init -b master`.
Follow the subdomain skill's steps 1 and 4 (repo creation, CI workflow copy with
`IMAGE_NAME=bumblecode/live`), but for steps 2–3 use queen's Node-app shape instead of
the skill's static-Astro shape:

- **Frontend**: Vite + React 19 SPA (`src/client/`), no router library needed (single
  page: signed-out view with a "Sign in with Google" link, signed-in view with the
  generator). Keep it visually consistent with the bumbleflies brand (reuse the
  dark/honey design tokens from `web/beta/src/styles/design-system.css` by copying the
  relevant CSS custom properties, not by depending on the `web` repo at build time).
- **Backend**: Express 5 (`src/server/`), plain REST (no tRPC — the API surface is two
  endpoints, tRPC's type-sharing benefit isn't worth the extra dependency here; this is
  one deliberate simplification from queen's stack).
- **No database.** Skip Mongoose/Mongo/Redis entirely. This app has no persistent data:
  every @bumbleflies.de account has equal access (no roles, unlike queen's admin/user
  split), and nothing needs to survive a restart. The JWT itself carries everything
  needed (`email`), signed straight from the verified Google profile in the OAuth
  callback. This is the main structural simplification vs. queen.
- `Dockerfile`: copy `queen/Dockerfile`'s shape (multi-stage `node:24-alpine`, `USER node`,
  `HEALTHCHECK CMD` on `GET /health`, `ENTRYPOINT`/`CMD` running the built server, port 3000).

### Auth
Mirror `queen/src/server/routes/auth.ts` closely:
- `passport-google-oauth20` strategy, scopes `['profile', 'email']` only (no Drive scope,
  this app never touches Drive).
- `GET /auth/google`, `GET /auth/google/callback`, `POST /auth/logout`, `GET /auth/me`,
  same route shapes and same `requireAuth` middleware pattern (bearer header or cookie,
  `jsonwebtoken` verify, 401 on failure).
- Cookie name `live_token` (this app's own name, not `queen_token`), same `httpOnly`,
  `sameSite: 'lax'`, `secure` in production, `12h` maxAge options as queen's
  `authCookieOptions()`.
- **Difference from queen**: the OAuth callback does not upsert a `User` document (no
  DB). It just takes the verified Google profile, extracts `email`, and signs
  `{ email }` directly into the JWT via a `signToken`/`verifyToken` pair copied from
  `queen/src/server/services/AuthService.ts` (drop the `role`/`isAdmin` logic, not needed).
- As defense in depth (the OAuth client is already Workspace-restricted, same trust
  boundary queen relies on), also check `email.endsWith('@bumbleflies.de')` in the
  callback and reject otherwise — cheap, and documents the restriction in code even
  though the OAuth client is the real gate.
- Env vars: reuse the **existing** bumbleflies Google OAuth client credentials
  (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — same ones queen/league.finance use, get
  the actual values added to this app's ansible-vault-protected env template, do not
  hardcode), plus a new `GOOGLE_CALLBACK_URL=https://live.bumbleflies.de/auth/google/callback`
  (needs adding as an authorized redirect URI on the shared OAuth client — a manual step
  in Google Cloud Console, call this out explicitly as a deploy prerequisite) and a new
  `JWT_SECRET` (freshly generated, not reused from queen).

### Core feature: room + links + scene-collection download
Port the logic from `bumble-live/tools/generate-links.sh` into TypeScript, reusing its
exact behavior and copy (don't redesign the warnings, they were hard-won this session):

- `POST /api/room` → generates a fresh alphanumeric room (`bumbleLive` + 4 random hex
  chars, same scheme the script's companion random-generation commands used this
  session) and password (12 random lowercase+digit chars), returns the 9 links as
  structured JSON: `{ director, guests: [{name, link, warning}], obsSources: [{name, link}],
  screenShare: {guestLink, obsLink} }`. Every guest link/warning string must match what
  `generate-links.sh` prints today, including:
  - "Do NOT use the director page's own INVITE A GUEST link" warning (the real bug this
    session found: it assigns a random push id, not the fixed one OBS watches).
  - The background-blur note: the `&backgroundblur` URL parameter does **not** reliably
    work (confirmed this session, tried bare and with `=5`), so the guest must enable it
    manually via VDO.Ninja's own camera/video icon toolbar after joining. Do not
    resurrect `&backgroundblur` in the generated link.
  - Screen share: "opens a SECOND browser tab, camera tab stays open" instruction.
  - Room/password are server-generated only, no free-text room-name field in the UI.
    This removes the alphanumeric-validation failure mode entirely (the hyphen bug this
    session hit) rather than re-validating user input for it.
- `POST /api/scene-collection` (same room/password as the last `/api/room` call) →
  loads a **vendored copy** of the restructured 8-scene template
  (`bumble-live/OBS/scene-collections/Bumbleflies-Live.json`, the version from this
  session with `03 Nico`/`04 Sebi`/`05 Chris` solo scenes, not the old 7-scene one with
  `Conversation`/`Speaker`) bundled into this repo at build time, applies the identical
  patch used in this session (set `Nico`/`Sebi`/`Chris`/`Screen` Browser Source `url` to
  `https://vdo.ninja/?view=<push>&solo&room=<room>&password=<password>`, leave overlay
  sources untouched), and streams it back as a downloadable `.json` with a sensible
  filename (`Bumbleflies-Live-<room>.json`). Note in the new repo's README that this
  vendored template can drift from `bumble-live/`'s if the scene layout changes there
  again, and should be re-copied by hand when that happens (no cross-repo build
  dependency, deliberately — this is a "small sidecar app").
- Frontend flow: signed-in page shows a "Generate new room" button (calls `/api/room`,
  replacing any previous result), the 9 links rendered with their warnings inline
  (copy-to-clipboard buttons are a nice-to-have, not required for v1), and a "Download
  OBS scene collection" button (calls `/api/scene-collection` for the currently
  displayed room, triggers a file download).

### Deployment
- New service block in `container/bumbleflies/docker-compose.yml`, modeled on the `edu`
  block's Traefik labels but:
  - `image: bumblecode/live:latest`
  - `traefik.http.routers.${SERVICE_NAME}-live.rule=Host(\`live.bumbleflies.de\`)`
  - `traefik.http.routers.${SERVICE_NAME}-live.tls.certresolver=letsencrypthttpresolver`
    (same resolver as `edu`/`bnb`/`www`, required for the GoDaddy-hosted domain)
  - `traefik.http.services.${SERVICE_NAME}-live.loadbalancer.server.port=3000` (not 80 —
    this is a live Node server like queen, not static nginx)
  - local-qualified dev router + `com.centurylinklabs.watchtower.scope=dev`, same as
    every other block in this file.
- New `live.env.j2` ansible template (model on `queen.env.j2`) carrying
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (reused values, pulled from the same vault
  entry queen uses)/`GOOGLE_CALLBACK_URL`/`JWT_SECRET` (new, generate with
  e.g. `openssl rand -hex 32`, store in `container/ansible/plays/vars/secrets.yml`,
  git-crypt protected like the rest of that file).
- Deploy test-first to `servyy-test.lxd` (org convention, see the subdomain skill and
  queen's `finance_services`-gated rollout) before production; production needs the
  same explicit-approval step as every other bumbleflies service.
- Add the new redirect URI to the **existing** shared Google OAuth client in Google
  Cloud Console (`https://live.bumbleflies.de/auth/google/callback`) — a manual,
  one-time console step, call it out as a deploy blocker if skipped (login will fail
  with a redirect_uri_mismatch otherwise).

A tracking issue for the infra-side (servyy-container) work this depends on is filed at
`dachrisch/servyy-container` — see that repo's issues for the docker-compose block,
ansible env template, vault secret, and OAuth redirect URI steps.

### Homepage link (small, optional polish)
Add a single link to `live.bumbleflies.de` somewhere appropriate in `web/beta` (e.g. the
footer, or near wherever team-internal tooling is already referenced, if anywhere) —
low priority, do last, and only if it doesn't require its own design-review detour.

## Verification

- **Unit tests** (vitest, mirrors the manual checks done by hand this session):
  - Room/password generator never produces non-alphanumeric room names.
  - Scene-collection transform, given a room+password, produces JSON where: it's valid
    JSON, `scene_order` names exactly match scene `sources` entries, no scene item
    references a source name that doesn't exist (the exact dangling-reference check run
    manually this session), and the four VDO.Ninja sources carry the correct `view=`/
    `room=`/`password=` values while overlay sources (`Overlay Starting` etc.) are
    unchanged.
  - Auth: `requireAuth` rejects a missing/invalid cookie and bearer token; `/auth/me`
    returns the email claim for a valid token.
- **Docker build + health check**: reuse the `test-image.yml` pattern from `web`/queen —
  build the image, run it, `curl localhost:3000/health` expects 200.
- **Manual QA before first real use**:
  1. Deploy to `servyy-test`, sign in with a real `@bumbleflies.de` Google account,
     confirm login succeeds and `/auth/me` shows the right email.
  2. Confirm a non-`@bumbleflies.de` Google account is rejected (tests the OAuth client
     restriction, the actual security boundary).
  3. Click "Generate new room", confirm the 9 links match the shape/warnings of
     `tools/generate-links.sh`'s current output.
  4. Download the scene collection, import it into a local **test** OBS scene
     collection (not the production one), confirm `Nico`/`Sebi`/`Chris`/`Screen`
     sources show the right URLs and OBS doesn't complain about the file on import.
  5. Only after that, promote to production per the existing gated-rollout process.
