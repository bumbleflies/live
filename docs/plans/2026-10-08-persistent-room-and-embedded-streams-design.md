# Design: persistent room + embedded VDO windows (`live.bumbleflies.de` v1.1)

Agreed 2026-10-08 with the user (dachrisch). Two changes on top of the v1 app:
stable reusable links, and embedding the guests' own streaming windows in the app.

## Goal

The host's OBS must be set up **once** and reused every session. Each guest
("host" of his own window) gets his streaming window right on the live site —
no separate vdo.ninja tab, no per-session regeneration.

## 1. Room persistence & rotation (backend)

The room stops being per-session. The server keeps **one current room**
(`{room, password}` + links) in a single JSON file under `DATA_DIR` (default
`./data`; compose mounts a named volume `live-data:/data` so it survives
restarts and watchtower image updates).

- On boot with a missing file: generate the room (`bumbleLive` + 4 hex, same
  scheme as v1), write the file atomically.
- `POST /api/room` becomes **idempotent**: returns the *current* room with its
  links, same response shape as v1. Frequent calls never rotate anything.
- New `POST /api/room/rotate`: generates a fresh room/password, overwrites the
  file, returns it with a flag driving the red warning in the UI ("all
  previously sent links are dead; guests need the new links; OBS needs one
  re-import of the newly downloaded scene collection").
- Links builder, scene-collection patch, and auth are untouched — rotation only
  changes the inputs to `buildLinks()`.
- No accidental rotation is possible server-side: only the explicit rotate
  endpoint overwrites the file. `DATA_DIR` unmounted (dev) degrades to a local
  folder; rotation then happens across container replacement, which is fine for
  dev.
- Infra follow-up (servyy-container ticket): add the volume to the `live`
  compose block (one line), nothing else changes there.

Testing: unit tests for ensure/rotate/persistence against a temp `DATA_DIR`;
endpoint tests updated (no 409-before-first-room case — a room always exists).

## 2. Embedded streaming windows (frontend)

The signed-in page embeds the **publish windows** — the guest links themselves,
not OBS view feeds:

- Four tabs/cards: Nico, Sebi, Chris, Screen, each embedding that person's
  guest link (`?room=...&password=...&push=<Name>Cam&label=<Name>`) as an
  iframe. Anyone signed in opens their own card, grants camera/mic, and is in
  the room from the page.
- iframes need `allow="camera; microphone; display-capture; autoplay;
  fullscreen"` (documented VDO iframe pattern; browsers gate camera/mic access
  on the iframe allow-list). Each card keeps an "open in new tab" fallback for
  iframe/Safari quirks.
- No OBS view iframes anywhere. The scene-collection download covers OBS.
- The director stays a plain link/button opening a new tab (camera/mic-heavy
  page; avoids another permission-quirk surface).
- VDO.Ninja's own connecting/loader overlay inside the iframes on load is
  accepted; nothing to fix in this repo.

## 3. UI copy & modal

- "Generate new room" button is replaced by a **Rotate room…** button.
- Rotation confirmation and any destructive/error messaging uses a **real
  modal component** (title, explanatory body, Cancel/Rotate buttons), styled
  with the vendored design tokens. No `alert()`/`confirm()` anywhere.
- The repeated INVITE-A-GUEST lecture on guest links is shortened to a
  "permanent links — share once, pinned" hint while keeping the
  random-push-id warning itself (copy factually unchanged).

## Verification

- Unit + endpoint tests for ensure/rotate with temp `DATA_DIR`; rotate confirms
  old links invalid and file overwritten; `/api/room` does not rotate.
- Manual QA: confirm links stay identical across a container restart (with
  volume); embed grant camera/mic in Chrome; rotate flow shows modal, then
  rotates and warns; scene collection still imports.
