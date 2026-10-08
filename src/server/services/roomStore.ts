import fs from 'fs';
import path from 'path';
import { generatePassword, generateRoomName } from './roomLinks.js';

export interface StoredRoom {
  room: string;
  password: string;
}

export function resolveDataDir(): string {
  return process.env.DATA_DIR ?? path.join(process.cwd(), 'data');
}

export function stateFile(): string {
  return path.join(resolveDataDir(), 'state.json');
}

function valid(room: unknown): room is StoredRoom {
  const r = room as Partial<StoredRoom> | null;
  return (
    typeof r === 'object' &&
    r !== null &&
    typeof r.room === 'string' &&
    /^bumbleLive[0-9a-f]{4}$/.test(r.room) &&
    typeof r.password === 'string' &&
    /^[a-z0-9]{12}$/.test(r.password)
  );
}

/** Atomic replace: same-directory temp file + rename. */
function persist(room: StoredRoom): void {
  try {
    fs.mkdirSync(resolveDataDir(), { recursive: true });
    const tmp = `${stateFile()}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify({ ...room }, null, 2)}\n`);
    fs.renameSync(tmp, stateFile());
  } catch (err) {
    console.error(
      `roomStore: cannot write ${stateFile()} (DATA_DIR=${resolveDataDir()}). ` +
        'The dir must exist and be writable by the container user.',
      err,
    );
    throw err;
  }
}

/**
 * The current room is the stored one; missing or corrupt state self-heals by
 * generating and persisting a fresh room. This is the ONLY entry point for
 * reading — an explicit rotate is the only way the stored value ever changes.
 */
export function getRoom(): StoredRoom {
  let stored: unknown;
  try {
    stored = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
  } catch {
    // fall through to regenerate below
  }
  if (valid(stored)) {
    return stored;
  }
  const fresh: StoredRoom = { room: generateRoomName(), password: generatePassword() };
  persist(fresh);
  return fresh;
}

/** Explicit rotation: the only path that replaces the stored room. */
export function rotateRoom(): StoredRoom {
  const fresh: StoredRoom = { room: generateRoomName(), password: generatePassword() };
  persist(fresh);
  return fresh;
}
