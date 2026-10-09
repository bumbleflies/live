import { buildShareUrl, type Room } from '../lib/share';
import { LinkRow } from './links';

/**
 * Personal guest access links, rendered as full visible rows (label + URL +
 * copy button) like the Links section below. The URL text must be on the page:
 * copy-only buttons are too easy to miss when forwarding a link to a guest.
 */
export function GuestAccessLinks({ origin, room }: { origin: string; room: Room }) {
  const people = [...room.guests.map((g) => g.name), 'Guest', 'Screen'];
  return (
    <div>
      {people.map((person) => (
        <LinkRow
          key={person}
          label={`Guest link · ${person}`}
          link={buildShareUrl(origin, { room: room.room, password: room.password, person })}
        />
      ))}
    </div>
  );
}
