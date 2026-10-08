import sceneTemplate from '../../../bumble-live/OBS/scene-collections/Bumbleflies-Live.json';
import { obsViewLink, type Room } from '../services/roomLinks.js';

export interface SceneSource {
  name: string;
  settings?: { url?: string };
}

// Mapping of Browser Source names to the fixed push ids each watches.
// Everything else (Overlay Starting/Break/Ending, Lower Thirds, Bug and the
// scenes themselves) is left untouched.
function vdoPushFor(name: string): string | undefined {
  return ({
    Nico: 'NicoCam',
    Sebi: 'SebiCam',
    Chris: 'ChrisCam',
    Guest: 'GuestCam',
    Screen: 'ScreenShare',
  } as Record<string, string | undefined>)[name];
}

/**
 * Deep-clone the vendored template and patch exactly the four VDO.Ninja
 * Browser Sources. `JSON.parse(JSON.stringify(...))` also normalises the
 * template into a structure safe to mutate.
 */
export function buildSceneCollection(room: Room): typeof sceneTemplate {
  const data: typeof sceneTemplate = JSON.parse(JSON.stringify(sceneTemplate));
  const sources = (data as unknown as { sources: SceneSource[] }).sources;
  for (const source of sources) {
    const push = vdoPushFor(source.name);
    if (!push) {
      continue;
    }
    source.settings = {
      ...source.settings,
      url: obsViewLink(room.room, room.password, push),
    };
  }
  return data;
}

export function buildSceneCollectionJson(room: Room): string {
  return JSON.stringify(buildSceneCollection(room), null, 1) + '\n';
}

export function sceneCollectionFilename(room: string): string {
  return `Bumbleflies-Live-${room}.json`;
}
