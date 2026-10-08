import { describe, expect, it } from 'vitest';
import { buildLinks, GUEST_NAMES, generatePassword, generateRoomName } from '../services/roomLinks.js';

describe('room generator', () => {
  it('produces alphanumeric-only room names in the learned scheme', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateRoomName()).toMatch(/^bumbleLive[0-9a-f]{4}$/);
    }
  });

  it('produces 12-char lowercase+digit passwords', () => {
    for (let i = 0; i < 100; i++) {
      expect(generatePassword()).toMatch(/^[a-z0-9]{12}$/);
    }
  });
});

describe('buildLinks', () => {
  const room = buildLinks('room r~special', 'pass&word');
  const encodedRoom = encodeURIComponent('room r~special');
  const encodedPass = encodeURIComponent('pass&word');

  it('returns exactly the 11 links incl. the external guest slot', () => {
    const links = [
      room.director,
      ...room.guests.map((g) => g.link),
      room.externalGuest.link,
      ...room.obsSources.map((o) => o.link),
      room.screenShare.guestLink,
      room.screenShare.obsLink,
    ];
    expect(links).toHaveLength(11);
  });

  it('external guest watches the fixed GuestCam push id', () => {
    expect(room.externalGuest.link).toBe(
      `https://vdo.ninja/?room=${encodedRoom}&password=${encodedPass}&push=GuestCam&label=Guest`,
    );
    expect(room.obsSources.find((o) => o.name === 'Guest')?.link).toBe(
      `https://vdo.ninja/?view=GuestCam&solo&room=${encodedRoom}&password=${encodedPass}`,
    );
  });

  it('encodes every parameter — room names are never assumed safe', () => {
    expect(room.director).toBe(
      `https://vdo.ninja/?director=${encodedRoom}&password=${encodedPass}&scenerestore`,
    );
  });

  it('uses the fixed push ids OBS watches', () => {
    for (const name of GUEST_NAMES) {
      expect(
        room.guests.find((g) => g.name === name)?.link,
      ).toBe(`https://vdo.ninja/?room=${encodedRoom}&password=${encodedPass}&push=${name}Cam&label=${name}`);
    }
  });

  it('OBS view links watch the fixed push ids with solo', () => {
    expect(room.obsSources[0]).toEqual({
      name: 'Nico',
      link: `https://vdo.ninja/?view=NicoCam&solo&room=${encodedRoom}&password=${encodedPass}`,
    });
    expect(room.screenShare.obsLink).toBe(
      `https://vdo.ninja/?view=ScreenShare&solo&room=${encodedRoom}&password=${encodedPass}`,
    );
  });

  it('does NOT resurrect &backgroundblur in any generated link', () => {
    const all = [
      room.director,
      ...room.guests.map((g) => g.link),
      room.externalGuest.link,
      ...room.obsSources.map((o) => o.link),
      room.screenShare.guestLink,
      room.screenShare.obsLink,
    ];
    for (const link of all) {
      expect(link).not.toContain('backgroundblur');
    }
  });

  it('carries the hard-won warnings verbatim per topic', () => {
    for (const guest of [...room.guests, room.externalGuest]) {
      expect(guest.warning).toMatch(/Do NOT use the director page's own INVITE A GUEST link/);
      expect(guest.warning).toMatch(/random push id, not the fixed one OBS watches/);
      expect(guest.warning).toMatch(/background blur manually after joining/);
    }
    expect(room.externalGuest.warning).toMatch(/external interview guest slot/);
    expect(room.screenShare.warning).toMatch(/opens a SECOND browser tab/);
    expect(room.screenShare.warning).toMatch(/camera tab stays open/);
  });
});
