export interface GuestLink {
  name: string;
  link: string;
  warning?: string;
}

export interface ObsSource {
  name: string;
  link: string;
}

export interface Room {
  room: string;
  password: string;
  director: string;
  guests: GuestLink[];
  obsSources: ObsSource[];
  screenShare: { guestLink: string; obsLink: string; warning?: string };
}

const VDO = 'https://vdo.ninja';

// URL-encode everything — matches the script's `enc()` helper.
function enc(value: string): string {
  return encodeURIComponent(value);
}

function randomFrom(alphabet: string, len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

const HEX = '0123456789abcdef';
const PASSWORD_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

// `bumbleLive` + 4 random hex chars — same scheme the session's random
// generation used. Alphanumeric only, eliminating the VDO.Ninja room-name
// validation failure mode (e.g. hyphens) entirely.
export function generateRoomName(): string {
  return `bumbleLive${randomFrom(HEX, 4)}`;
}

export function generatePassword(): string {
  return randomFrom(PASSWORD_ALPHABET, 12);
}

export const GUEST_NAMES = ['Nico', 'Sebi', 'Chris'] as const;

export function guestLink(room: string, password: string, name: string): string {
  return `${VDO}/?room=${enc(room)}&password=${enc(password)}&push=${name}Cam&label=${name}`;
}

export function obsViewLink(room: string, password: string, push: string): string {
  return `${VDO}/?view=${push}&solo&room=${enc(room)}&password=${enc(password)}`;
}

export function buildLinks(room: string, password: string): Room {
  return {
    room,
    password,
    director: `${VDO}/?director=${enc(room)}&password=${enc(password)}&scenerestore`,
    guests: GUEST_NAMES.map((name) => ({
      name,
      link: guestLink(room, password, name),
      warning:
        "Do NOT use the director page's own INVITE A GUEST link — it assigns a random push id, not the fixed one OBS watches. Send this link to the guest manually. The &backgroundblur parameter does not work reliably, so the guest enables background blur manually after joining, via VDO.Ninja's own camera/video icon toolbar.",
    })),
    obsSources: GUEST_NAMES.map((name) => ({
      name,
      link: obsViewLink(room, password, `${name}Cam`),
    })),
    screenShare: {
      guestLink: `${VDO}/?room=${enc(room)}&password=${enc(password)}&push=ScreenShare&label=Screen`,
      obsLink: obsViewLink(room, password, 'ScreenShare'),
      warning:
        'Screen share: opens a SECOND browser tab, the camera tab stays open. Keep this backup slot unused until a screen share is needed.',
    },
  };
}
