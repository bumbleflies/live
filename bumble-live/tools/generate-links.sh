#!/usr/bin/env bash
# Builds VDO.Ninja guest links, director link, and OBS view links, and
# patches the four VDO.Ninja Browser Sources (Nico, Sebi, Chris, Screen) in
# the real local OBS scene collection, so you don't paste URLs by hand.
# Usage: ./generate-links.sh <room> <password>
# Example: ./generate-links.sh bumbleLive7f42 "correct-horse-9"
#
# Override OBS_SCENE_FILE to point at a different scene collection file.
set -euo pipefail

ROOM="${1:-}"
PASS="${2:-}"

if [ -z "$ROOM" ] || [ -z "$PASS" ]; then
  echo "Usage: $0 <room> <password>" >&2
  exit 1
fi

if [[ ! "$ROOM" =~ ^[A-Za-z0-9]+$ ]]; then
  echo "Error: room name must be alphanumeric only (letters and digits, no hyphens or underscores)." >&2
  echo "VDO.Ninja silently rewrites other characters, which just shows guests a warning popup. Got: $ROOM" >&2
  exit 1
fi

enc() {
  python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"
}

ROOM_E=$(enc "$ROOM")
PASS_E=$(enc "$PASS")

echo "Room: $ROOM"
echo ""
echo "DIRECTOR (host only, keep private):"
echo "https://vdo.ninja/?director=${ROOM_E}&password=${PASS_E}&scenerestore"
echo ""
for NAME in Nico Sebi Chris; do
  PUSH="${NAME}Cam"
  echo "GUEST ${NAME} (send privately, must use this EXACT link):"
  echo "https://vdo.ninja/?room=${ROOM_E}&password=${PASS_E}&push=${PUSH}&label=${NAME}"
  echo "Do NOT use the director page's own \"INVITE A GUEST\" link: it assigns a"
  echo "random id per join, not ${PUSH}, and OBS only watches ${PUSH}."
  echo "Background blur does NOT reliably turn on from the &backgroundblur in this"
  echo "link (confirmed, tried bare and with =5, neither worked). After joining,"
  echo "click the camera/video icon in VDO.Ninja's own toolbar at the bottom of the"
  echo "page and enable Background Blur there manually. It then stays on for that"
  echo "room/push id."
  echo ""
  echo "OBS SOURCE ${NAME} (Browser Source, 1920x1080):"
  echo "https://vdo.ninja/?view=${PUSH}&solo&room=${ROOM_E}&password=${PASS_E}"
  echo ""
done
echo "SCREEN SHARE (presenter opens a SECOND browser tab for this, camera tab stays"
echo "open and untouched, must use this EXACT link):"
echo "https://vdo.ninja/?room=${ROOM_E}&password=${PASS_E}&push=ScreenShare&label=Screen"
echo "In that tab, choose Screen/Window/Tab when asked for a source, not webcam."
echo ""
echo "OBS SOURCE Screen (Browser Source, 1920x1080):"
echo "https://vdo.ninja/?view=ScreenShare&solo&room=${ROOM_E}&password=${PASS_E}"
echo ""

# --- Patch the real OBS scene collection, if it exists and OBS is closed ---
OBS_SCENE_FILE="${OBS_SCENE_FILE:-$HOME/.config/obs-studio/basic/scenes/Bumbleflies-Live.json}"

if pgrep -x obs >/dev/null 2>&1; then
  echo "OBS is currently running, not touching ${OBS_SCENE_FILE}." >&2
  echo "Close OBS and re-run this script to update its Browser Sources automatically," >&2
  echo "or paste the OBS SOURCE links above into each source's Properties by hand." >&2
  exit 0
fi

if [ ! -f "$OBS_SCENE_FILE" ]; then
  echo "No OBS scene collection found at ${OBS_SCENE_FILE}, skipping auto-update." >&2
  exit 0
fi

BACKUP="${OBS_SCENE_FILE}.bak.$(date +%Y%m%dT%H%M%S)"
cp "$OBS_SCENE_FILE" "$BACKUP"

UPDATED=$(python3 - "$OBS_SCENE_FILE" "$ROOM" "$PASS" <<'PYEOF'
import json
import sys
import urllib.parse

path, room, password = sys.argv[1], sys.argv[2], sys.argv[3]
room_e = urllib.parse.quote(room, safe="")
pass_e = urllib.parse.quote(password, safe="")

# Source name -> its fixed VDO.Ninja push id (matches the GUEST/OBS SOURCE
# links printed above).
pushes = {"Nico": "NicoCam", "Sebi": "SebiCam", "Chris": "ChrisCam", "Screen": "ScreenShare"}

with open(path) as f:
    data = json.load(f)

updated = []
for source in data.get("sources", []):
    push = pushes.get(source.get("name"))
    if push and source.get("id") == "browser_source":
        url = f"https://vdo.ninja/?view={push}&solo&room={room_e}&password={pass_e}"
        source.setdefault("settings", {})["url"] = url
        updated.append(source["name"])

with open(path, "w") as f:
    json.dump(data, f, indent=4)
    f.write("\n")

print(",".join(updated))
PYEOF
)

if [ -z "$UPDATED" ]; then
  echo "Patched ${OBS_SCENE_FILE} but found none of Nico/Sebi/Chris/Screen as browser_source entries." >&2
  echo "Backup kept at ${BACKUP}; check the source names match." >&2
else
  echo "Patched OBS sources in ${OBS_SCENE_FILE}: ${UPDATED}" >&2
  echo "Backup saved at ${BACKUP}." >&2
  echo "Open OBS: Nico/Sebi/Chris/Screen already point at this room." >&2
fi
