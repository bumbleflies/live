# bumble:live

Reusable livestream kit for Bumbleflies. One production machine owns the YouTube stream. Three people join as remote contributors over VDO.Ninja.

```text
Nico ──┐
       │     ┌────────────┐     ┌─────────┐
Sebi ──┼──>  │ VDO.Ninja  │──>  │ OBS     │──> YouTube Live
       │     │ room       │     │ (host)  │
Chris ─┘     └────────────┘     └─────────┘
```

Stack: VDO.Ninja (remote video and audio) plus OBS Studio (production) plus YouTube Live (distribution). Guests need only Chrome or Firefox and headphones. No self hosted media server for version one.

## What is in here

```text
bumble-live/
├── README.md                  This file
├── runbook.md                 Full host runbook, tailored to Linux plus NVENC
├── CHECKLIST.md               One page checklist for 30 minutes before going live
├── OBS/
│   ├── profiles/Bumbleflies-YouTube/   Importable OBS profile (1080p30, NVENC, CBR)
│   └── scene-collections/Bumbleflies-Live.json  10 scenes, prewired
├── overlays/                  Branded 1920x1080 HTML overlays (local files in OBS)
│   ├── starting.html
│   ├── break.html
│   ├── ending.html
│   ├── lower-thirds.html
│   └── bug.html
└── tools/generate-links.sh    Builds guest invite links and OBS view links
```

## Operating procedure (the 12 steps)

1. Create the YouTube event (Unlisted for rehearsal, then Public or Unlisted for real).
2. Pick a VDO.Ninja room name and password. Room name must be alphanumeric only, no
   hyphens or underscores (VDO.Ninja rewrites anything else and shows a warning popup).
   Example: `bumbleLivexxxx` plus a random password.
3. With OBS closed, run `tools/generate-links.sh <room> <password>` to build 3 guest
   links plus 1 director link plus 3 OBS view links, and to patch the real `Nico`,
   `Sebi`, `Chris`, `Screen` Browser Sources in your local scene collection directly.
4. Send the 3 guest links privately. Never post the room password in a public issue or wiki.
5. Open OBS with profile `Bumbleflies YouTube` and scene collection `Bumbleflies Live`.
6. Confirm the four Browser Sources already show live video (step 3 wired them up; see
   "Replacing placeholder URLs" below if OBS was open when you ran the generator).
7. Add overlays as Browser Sources with Local file checked, 1920x1080.
8. Test audio: every person says check one two three, watch OBS meters, headphones on for all.
9. Start streaming in OBS, then check the YouTube preview (never trust OBS alone).
10. Produce with scenes: Starting, All hosts, Hosts plus Guest, Hosts plus Screen, Focus Nico, Focus Sebi, Focus Chris, Focus Guest, Break, End.
11. End the YouTube stream in YouTube Studio, then Stop Streaming in OBS.
12. Save the recording and note what to fix next time.

Details live in `runbook.md`. The short version for show day lives in `CHECKLIST.md`.

## Importing into OBS (Linux)

Profile:

```text
OBS > Profile > Import > select OBS/profiles/Bumbleflies-YouTube/
```

Scene collection:

```text
OBS > Scene Collection > Import > select OBS/scene-collections/Bumbleflies-Live.json
```

Then set your stream key under `Settings > Stream` (Service: YouTube). Treat the stream key like a password.

## Replacing placeholder URLs

The scene collection ships with placeholder view URLs:

```text
https://vdo.ninja/?view=REPLACE_Nico&solo&room=REPLACE_ROOM
```

`tools/generate-links.sh` replaces these automatically: it finds `Nico`, `Sebi`,
`Chris`, and `Screen` in your local scene collection
(`~/.config/obs-studio/basic/scenes/Bumbleflies-Live.json` by default, override with
`OBS_SCENE_FILE`) and writes the real view URL into each, backing up the file first
with a timestamp.

This only happens if OBS is closed when you run the script (it checks, and refuses to
touch a file OBS might also be writing to). If OBS was open, or you're setting this up
on a machine without that scene collection file yet, do it by hand instead: in OBS,
right click each source (`Nico`, `Sebi`, `Chris`, `Screen`), Properties, paste the real
view URL from the generator's output. Width 1920, Height 1080.

## Branding

Overlays use Bumbleflies Direction A tokens: cream `#f5f1e8`, paper `#faf7f0`, ink `#1a1714`, honey amber `#a67c4d`, deep blue `#4a3f8f`. Display face is Instrument Serif with system serif fallback, body is system sans. No external fonts, so overlays render offline in OBS.

Show title is `bumble:live`. Keep that string on Starting, Break, and Ending screens so the format is recognizable.
