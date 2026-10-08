beforeAll(() => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'live-roomstore-'));
});

afterAll(() => {
  fs.rmSync(process.env.DATA_DIR as string, { recursive: true, force: true });
});

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getRoom, rotateRoom, stateFile } from '../services/roomStore.js';

describe('roomStore', () => {
  it('generates and persists a room when no state file exists', () => {
    const room = getRoom();
    expect(room.room).toMatch(/^bumbleLive[0-9a-f]{4}$/);
    expect(fs.existsSync(stateFile())).toBe(true);
  });

  it('returns the same room on every subsequent call', () => {
    const first = getRoom();
    const second = getRoom();
    expect(second).toEqual(first);
  });

  it('stores only room and password on disk', () => {
    const disk = JSON.parse(fs.readFileSync(stateFile(), 'utf8')) as Record<string, string>;
    expect(Object.keys(disk).sort()).toEqual(['password', 'room']);
    expect(disk).toEqual(getRoom());
  });

  it('rotateRoom overwrites the file and never repeats the old room', () => {
    const before = getRoom();
    const rotated = rotateRoom();
    expect(rotated.room).toMatch(/^bumbleLive[0-9a-f]{4}$/);
    expect(JSON.parse(fs.readFileSync(stateFile(), 'utf8'))).toEqual(rotated);
    expect(getRoom()).toEqual(rotated);
    expect(rotated.room).not.toBe(before.room);
  });

  it('self-heals from a corrupt state file', () => {
    fs.writeFileSync(stateFile(), 'not json');
    const healed = getRoom();
    expect(healed.room).toMatch(/^bumbleLive[0-9a-f]{4}$/);
    expect(JSON.parse(fs.readFileSync(stateFile(), 'utf8'))).toEqual(healed);
  });

  it('self-heals from a structurally invalid state file', () => {
    fs.writeFileSync(stateFile(), JSON.stringify({ room: '', password: 'x' }));
    expect(getRoom().room).toMatch(/^bumbleLive[0-9a-f]{4}$/);
  });
});
