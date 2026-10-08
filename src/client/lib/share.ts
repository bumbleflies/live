/**
 * Anonymous share capability.
 *
 * A share link is `https://live.bumbleflies.de/#r=<room>&p=<password>&person=X`
 * (person optional). Everything lives in the URL fragment: the browser never
 * sends a fragment to the server, so the room secret cannot leak through access
 * logs or API traffic, and both the public landing and the guest view make zero
 * authenticated calls. The exposure equals that of sending the guest their
 * vdo.ninja link directly; rotating the room revokes every share link.
 *
 * Per-person binding is a UI policy, not cryptography: the fragment contains
 * everything needed to reach the whole room, so treat guest links like keys.
 */
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
  externalGuest: GuestLink;
  obsSources: ObsSource[];
  screenShare: { guestLink: string; obsLink: string; warning?: string };
}

export interface ShareLink {
  room: string;
  password: string;
  person?: string;
}

export function buildShareHash({ room, password, person }: ShareLink): string {
  let hash = `#r=${encodeURIComponent(room)}&p=${encodeURIComponent(password)}`;
  if (person) {
    hash += `&person=${encodeURIComponent(person)}`;
  }
  return hash;
}

export function buildShareUrl(base: string, link: ShareLink): string {
  return `${base.replace(/\/*$/, '')}/${buildShareHash(link)}`;
}

export function parseShareHash(hash: string): ShareLink | null {
  if (!hash.startsWith('#')) {
    return null;
  }
  const params = new URLSearchParams(hash.slice(1));
  const room = params.get('r')?.trim();
  const password = params.get('p')?.trim();
  if (!room || !password) {
    return null;
  }
  const person = params.get('person')?.trim() || undefined;
  return { room, password, person };
}

/** Accepts a full share URL, a `#…` fragment, or a bare `r=…&p=…` code. */
export function parseAccessCode(input: string): ShareLink | null {
  const trimmed = input.trim();
  if (trimmed.startsWith('#')) {
    return parseShareHash(trimmed);
  }
  const marker = trimmed.search(/[&#?]r=/);
  if (marker !== -1) {
    return parseShareHash(trimmed.slice(marker));
  }
  return parseShareHash(`#${trimmed}`);
}

const VDO = 'https://vdo.ninja';

/** The fixed push id each person publishes under. */
export function pushFor(person: string): string {
  if (person === 'Screen') return 'ScreenShare';
  if (person === 'Guest') return 'GuestCam';
  return `${person}Cam`;
}

/** Publish (join/camera) URL for a person, composed purely from the room secret. */
export function buildPublishUrl(room: string, password: string, person: string): string {
  return `${VDO}/?room=${encodeURIComponent(room)}&password=${encodeURIComponent(password)}&push=${pushFor(person)}&label=${person}`;
}

/** VDO.Ninja director URL for room control (the guest tier's 'control the show' link). */
export function buildDirectorUrl(room: string, password: string): string {
  return `${VDO}/?director=${encodeURIComponent(room)}&password=${encodeURIComponent(password)}&scenerestore`;
}

/** OBS-facing solo view URL, composed purely from the room secret. */
export function buildSoloViewUrl(room: string, password: string, person: string): string {
  return `${VDO}/?view=${pushFor(person)}&solo&room=${encodeURIComponent(room)}&password=${encodeURIComponent(password)}`;
}

/**
 * Client-side facade of a room for the guest view: same shape the member API
 * returns, built purely from the room secret in the hash.
 */
export function buildFacadeRoom(room: string, password: string): Room {
  const hosts = ['Nico', 'Sebi', 'Chris'];
  return {
    room,
    password,
    director: buildDirectorUrl(room, password),
    guests: hosts.map((name) => ({ name, link: buildPublishUrl(room, password, name) })),
    externalGuest: { name: 'Guest', link: buildPublishUrl(room, password, 'Guest') },
    obsSources: [...hosts.map((name) => ({ name, link: buildSoloViewUrl(room, password, name) })), {
      name: 'Guest',
      link: buildSoloViewUrl(room, password, 'Guest'),
    }],
    screenShare: {
      guestLink: buildPublishUrl(room, password, 'Screen'),
      obsLink: buildSoloViewUrl(room, password, 'Screen'),
    },
  };
}
