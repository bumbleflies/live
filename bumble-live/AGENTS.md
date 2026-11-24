# AGENTS.md — bumble-live/

The full bumble:live host kit: `runbook.md` (production procedure), `CHECKLIST.md`
(show-day checklist), `OBS/` (profile and 10-scene collection), `overlays/` (local HTML
overlays) and `tools/generate-links.sh`. It moved here from bumbleflies/web and is now
the single source of truth. Repo-wide commands and policies live in the
[root AGENTS.md](../AGENTS.md).

## Rules specific to this directory

- **The scene collection is the source of truth.** The server imports
  `OBS/scene-collections/Bumbleflies-Live.json` directly. Make scene/source changes here;
  never edit a copied file elsewhere.
- **Room names must be alphanumeric only.** No hyphens or underscores — VDO.Ninja
  rewrites other characters and shows guests a warning popup. `tools/generate-links.sh
  <room> <password>` enforces this.
- **Only the generator's links work.** Guests must use the exact printed
  `push=NicoCam|SebiCam|ChrisCam` links, and screen share the exact `push=ScreenShare`
  link in a second browser tab while the camera tab stays open. Never the director
  page's own "INVITE A GUEST" quick-copy link: it assigns a random push id per join, so
  the matching OBS source stays black.
- **Room password, director link, guest links and stream key are secrets.** Send guest
  links privately; never put the password or stream key in a public issue, wiki or chat.
- **Run the generator with OBS closed.** It patches the real local scene collection
  (`~/.config/obs-studio/basic/scenes/Bumbleflies-Live.json`, override with
  `OBS_SCENE_FILE`) and backs it up with a timestamp first; it refuses to touch the file
  while OBS is running. If OBS was open, paste the printed OBS SOURCE URLs into each
  source's Properties by hand (Browser Source, 1920x1080).
- **Background blur is manual.** `&backgroundblur` in the links is unreliable; each
  person enables it from VDO.Ninja's own toolbar after joining.
- **Overlays render offline.** Keep them local-file Browser Sources with no external
  fonts, and keep the `bumble:live` show title on the Starting, Break and Ending screens.
- **Show-day process lives here**, not in chat: `runbook.md` (12 steps and emergency
  plan) and `CHECKLIST.md` (T-30 to T-0). Rehearse and trust the YouTube preview over
  OBS; end the YouTube stream in YouTube Studio before stopping OBS.
