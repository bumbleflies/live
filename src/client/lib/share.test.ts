import { describe, expect, it } from 'vitest';
import {
  buildDirectorUrl,
  buildFacadeRoom,
  buildPublishUrl,
  buildShareHash,
  buildShareUrl,
  buildSoloViewUrl,
  parseAccessCode,
  parseShareHash,
} from './share';

describe('share links (anonymous guest capability)', () => {
  const link = { room: 'r&=x y', password: 'p?/z' };

  it('round-trips hash → parse', () => {
    expect(parseShareHash(buildShareHash({ ...link, person: 'Nico' }))).toEqual({
      room: 'r&=x y',
      password: 'p?/z',
      person: 'Nico',
    });
  });

  it('person is optional on both sides', () => {
    const hash = buildShareHash(link);
    expect(hash).not.toContain('person');
    expect(parseShareHash(hash)).toEqual({ room: link.room, password: link.password, person: undefined });
  });

  it('encodes the room and password — they may contain anything', () => {
    const hash = buildShareHash({ ...link, person: 'Nico' });
    expect(hash).toContain('r=r%26%3Dx%20y');
    expect(hash).toContain('p=p%3F%2Fz');
  });

  it('builds a full URL without trailing-slash duplication', () => {
    expect(buildShareUrl('https://live.bumbleflies.de/', { room: 'a', password: 'b' })).toBe(
      'https://live.bumbleflies.de/#r=a&p=b',
    );
    expect(buildShareUrl('https://live.bumbleflies.de', { room: 'a', password: 'b', person: 'Nico' })).toBe(
      'https://live.bumbleflies.de/#r=a&p=b&person=Nico',
    );
  });

  it.each([
    ['no hash', ''],
    ['bare hash', '#'],
    ['missing password', '#r=room'],
    ['missing room', '#p=p'],
    ['not a hash at all', 'https://example.com/#r=a&p=b'],
    ['empty values', '#r=&p='],
  ])('rejects %s', (_name, hash) => {
    expect(parseShareHash(hash)).toBeNull();
  });

  it('parseAccessCode accepts a full share URL, a fragment and a bare code', () => {
    expect(parseAccessCode('https://live.bumbleflies.de/#r=a&p=b&person=Nico')).toEqual({
      room: 'a',
      password: 'b',
      person: 'Nico',
    });
    expect(parseAccessCode('#r=a&p=b')).toEqual({ room: 'a', password: 'b', person: undefined });
    expect(parseAccessCode('r=a&p=b')).toEqual({ room: 'a', password: 'b', person: undefined });
    expect(parseAccessCode('guessing')).toBeNull();
  });

  it('composes publish, solo-view and director URLs from the room secret', () => {
    expect(buildPublishUrl('r', 'p', 'Nico')).toBe(
      'https://vdo.ninja/?room=r&password=p&push=NicoCam&label=Nico',
    );
    expect(buildPublishUrl('r', 'p', 'Screen')).toBe(
      'https://vdo.ninja/?room=r&password=p&push=ScreenShare&label=Screen',
    );
    expect(buildSoloViewUrl('r', 'p', 'Guest')).toBe(
      'https://vdo.ninja/?view=GuestCam&solo&room=r&password=p',
    );
    expect(buildDirectorUrl('r', 'p')).toBe(
      'https://vdo.ninja/?director=r&password=p&scenerestore',
    );
  });

  it('builds a full room facade purely from the hash secret', () => {
    const facade = buildFacadeRoom('r', 'p');
    expect(facade.guests.map((g) => g.name)).toEqual(['Nico', 'Sebi', 'Chris']);
    expect(facade.externalGuest.name).toBe('Guest');
    expect(facade.obsSources).toHaveLength(4);
    expect(facade.obsSources.find((o) => o.name === 'Guest')?.link).toBe(
      'https://vdo.ninja/?view=GuestCam&solo&room=r&password=p',
    );
    expect(facade.screenShare.obsLink).toBe('https://vdo.ninja/?view=ScreenShare&solo&room=r&password=p');
    expect(facade.director).toBe('https://vdo.ninja/?director=r&password=p&scenerestore');
  });
});
