import { describe, expect, it } from 'vitest';
import { buildLinks } from '../services/roomLinks.js';
import { buildSceneCollection, buildSceneCollectionJson, sceneCollectionFilename } from '../routes/sceneCollection.js';

interface SceneSource {
  name: string;
  id?: string;
  settings?: { url?: string };
}

describe('scene-collection transform', () => {
  const room = buildLinks('bumbleLive1a2b', 'abcdef123456');
  const data = buildSceneCollection(room) as unknown as {
    scene_order: { name: string }[];
    sources: SceneSource[];
    current_scene: string;
  };

  it('is valid JSON on the wire and keeps the 8 restructured scenes', () => {
    const parsed = JSON.parse(buildSceneCollectionJson(room)) as {
      scene_order: { name: string }[];
      sources: SceneSource[];
    };
    expect(parsed.scene_order.map((s) => s.name)).toEqual([
      '01 Starting',
      '02 Three',
      '03 Nico',
      '04 Sebi',
      '05 Chris',
      '06 Screen plus People',
      '07 Break',
      '08 End',
    ]);
    const sceneNames = parsed.sources
      .filter((s) => s.id === 'scene')
      .map((s) => s.name);
    expect(parsed.scene_order.map((s) => s.name)).toEqual(sceneNames);
  });

  it('has no scene item referencing a missing source (dangling-reference check)', () => {
    const sourceNames = new Set(data.sources.map((s) => s.name));
    const scenes = data.sources.filter((s) => s.id === 'scene');
    // Explicit count so a structurally broken template cannot make this loop a no-op.
    expect(scenes).toHaveLength(8);
    for (const scene of scenes) {
      const items = scene.settings?.items as { name: string }[] | undefined;
      expect(items?.length).toBeGreaterThan(0);
      for (const item of items ?? []) {
        expect(sourceNames.has(item.name), `${scene.name} references "${item.name}"`).toBe(true);
      }
    }
  });

  it.each([
    ['Nico', 'NicoCam'],
    ['Sebi', 'SebiCam'],
    ['Chris', 'ChrisCam'],
    ['Screen', 'ScreenShare'],
  ])('patches %s with view=%s and the generated room/password', (name, push) => {
    const url = data.sources.find((s) => s.name === name)?.settings?.url;
    expect(url).toBe(
      `https://vdo.ninja/?view=${push}&solo&room=${room.room}&password=${room.password}`,
    );
  });

  it('leaves overlay sources untouched', () => {
    expect(data.sources.find((s) => s.name === 'Overlay Starting')?.settings?.url).toBe(
      'file:///REPLACE_WITH_ABSOLUTE_PATH/bumble-live/overlays/starting.html',
    );
    expect(data.sources.find((s) => s.name === 'Lower Thirds')?.settings?.url).toBe(
      'file:///REPLACE_WITH_ABSOLUTE_PATH/bumble-live/overlays/lower-thirds.html',
    );
  });

  it('names the download after the room', () => {
    expect(sceneCollectionFilename(room.room)).toBe(`Bumbleflies-Live-${room.room}.json`);
  });
});
