import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { buildFacadeRoom } from '../lib/share';
import { GuestAccessLinks } from './GuestAccessLinks';

const ORIGIN = 'https://live.bumbleflies.de';

describe('GuestAccessLinks', () => {
  it('renders one visible share URL per person', () => {
    const room = buildFacadeRoom('bumbleLive139', 'ix01uetwke5q');
    const html = renderToString(<GuestAccessLinks origin={ORIGIN} room={room} />);
    for (const person of ['Nico', 'Sebi', 'Chris', 'Guest', 'Screen']) {
      expect(html).toContain(`person=${person}`);
    }
    expect(html).toContain(`${ORIGIN}/#r=bumbleLive139`);
  });
});
