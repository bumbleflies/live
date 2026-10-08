import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  buildFacadeRoom,
  buildShareHash,
  buildShareUrl,
  parseAccessCode,
  parseShareHash,
  type Room,
} from './lib/share';
import './styles.css';

interface User {
  email: string;
}

const WINDOW_NAMES = ['Nico', 'Sebi', 'Chris', 'Guest', 'Screen'] as const;
type WindowName = (typeof WINDOW_NAMES)[number];

// Publish pages inside an iframe need the effective permissions listed here —
// browsers use allow-list to gate camera/mic in cross-origin frames.
const IFRAME_ALLOW =
  'camera; microphone; display-capture; autoplay; fullscreen; clipboard-write';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function LinkRow({ label, link }: { label: string; link: string }) {
  return (
    <div className="link-row">
      <span className="link-label">{label}</span>
      <a className="link-value" href={link} target="_blank" rel="noreferrer">
        {link}
      </a>
      <CopyBtn text={link} />
    </div>
  );
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);
  return (
    <button className={`copy-btn${copied ? ' copied' : ''}`} onClick={copy}>
      {copied ? 'copied' : label ?? 'copy'}
    </button>
  );
}

/**
 * Inline warning marker: a star that reveals its text as a tooltip on hover or
 * keyboard focus — replaces full-text warning paragraphs repeated per section.
 */
function TooltipStar({ children }: { children: ReactNode }) {
  return (
    <span
      className="tooltip"
      tabIndex={0}
      role="note"
      aria-label={typeof children === 'string' ? children : undefined}
    >
      <span className="warn-star" aria-hidden="true">
        *
      </span>
      <span className="tooltip-bubble">{children}</span>
    </span>
  );
}

function ConfirmRotateModal({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rotate-title">
        <h2 id="rotate-title">Rotate room?</h2>
        <p>
          All links sent so far stop working: guests need the new links, and OBS needs a
          one-time re-import of the newly downloaded scene collection. This cannot be
          undone.
        </p>
        <div className="modal-actions">
          <button className="btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Rotating…' : 'Rotate'}
          </button>
        </div>
      </div>
    </div>
  );
}

type SceneMode =
  | { kind: 'all' }
  | { kind: 'hosts-guest' }
  | { kind: 'hosts-screen' }
  | { kind: 'focus'; name: WindowName };

const SCENE_MODES: { mode: SceneMode; label: string }[] = [
  { mode: { kind: 'all' }, label: 'All hosts equally' },
  { mode: { kind: 'hosts-guest' }, label: 'Hosts + Guest' },
  { mode: { kind: 'hosts-screen' }, label: 'Hosts + Screen' },
  { mode: { kind: 'focus', name: 'Nico' }, label: 'Focus Nico' },
  { mode: { kind: 'focus', name: 'Sebi' }, label: 'Focus Sebi' },
  { mode: { kind: 'focus', name: 'Chris' }, label: 'Focus Chris' },
  { mode: { kind: 'focus', name: 'Guest' }, label: 'Focus Guest' },
  { mode: { kind: 'focus', name: 'Screen' }, label: 'Focus Screen' },
];

function Faces(room: Room): Record<WindowName, string> {
  return {
    Nico: room.obsSources.find((o) => o.name === 'Nico')!.link,
    Sebi: room.obsSources.find((o) => o.name === 'Sebi')!.link,
    Chris: room.obsSources.find((o) => o.name === 'Chris')!.link,
    Guest: room.obsSources.find((o) => o.name === 'Guest')!.link,
    Screen: room.screenShare.obsLink,
  };
}

/** The "host" publish links for the switch fallback — mirrors the OBS scenarios. */
function SceneSwitcher({ room }: { room: Room }) {
  const [mode, setMode] = useState<SceneMode>({ kind: 'all' });
  const solo = Faces(room);
  let names: WindowName[];
  let label: string;
  if (mode.kind === 'focus') {
    names = [mode.name];
    label = `Focus ${mode.name === 'Screen' ? 'Screen (backup slot)' : mode.name}`;
  } else if (mode.kind === 'hosts-guest') {
    names = ['Nico', 'Sebi', 'Chris', 'Guest'];
    label = 'Hosts + Guest';
  } else if (mode.kind === 'hosts-screen') {
    names = ['Nico', 'Sebi', 'Chris', 'Screen'];
    label = 'Hosts + Screen';
  } else {
    names = ['Nico', 'Sebi', 'Chris'];
    label = 'All hosts equally';
  }
  return (
    <div className="scene-block">
      <div className="scene-modes" role="tablist">
        {SCENE_MODES.map(({ mode: m, label: l }) => (
          <button
            key={l}
            className={`scene-mode-btn${JSON.stringify(m) === JSON.stringify(mode) ? ' active' : ''}`}
            onClick={() => setMode(m)}
          >
            {l}
          </button>
        ))}
      </div>
      <p className="hint">
        Live view of what OBS switch picks: {label}
      </p>
      <div className={names.length > 1 ? 'scene-panel grid' : 'scene-panel'}>
        {names.map((n) => (
          <iframe
            key={n}
            src={solo[n]}
            title={`${label} — ${n}`}
            allow={IFRAME_ALLOW}
            referrerPolicy="no-referrer"
          />
        ))}
      </div>
      <div className="window-foot">
        {names.length === 1 ? (
          <a href={names[0] === 'Screen' ? room.screenShare.guestLink : room.guests.find((g) => g.name === names[0])?.link ?? room.externalGuest.link} target="_blank" rel="noreferrer">
            open {label.replace('Focus ', '')} in new tab
          </a>
        ) : (
          <a href={room.director} target="_blank" rel="noreferrer">
            open director
          </a>
        )}
      </div>
    </div>
  );
}

function JoinWindow({ name, link, onClose }: { name: WindowName; link: string; onClose: () => void }) {
  const label = name === 'Screen' ? 'Screen (backup slot)' : name;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal join-modal" role="dialog" aria-modal="true">
        <h2>Join as {label}</h2>
        <p>Allow camera and microphone when asked. Closing the dialog leaves the room.</p>
        <iframe
          src={link}
          title={`Publish window ${name}`}
          allow={IFRAME_ALLOW}
          referrerPolicy="no-referrer"
        />
        <div className="modal-actions">
          <a className="btn" href={link} target="_blank" rel="noreferrer">
            open in new tab
          </a>
          <button className="btn btn-danger" onClick={onClose}>
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

function Generator({ user }: { user: User }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rotatedNote, setRotatedNote] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [joinName, setJoinName] = useState<WindowName | null>(null);

  // The room is persistent server-side; loading it is side-effect free.
  useEffect(() => {
    api<Room>('/api/room', { method: 'POST' })
      .then(setRoom)
      .catch(() => setError('Loading your room failed — reload the page.'));
  }, []);

  const rotate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await api<Room & { rotated: boolean }>('/api/room/rotate', {
        method: 'POST',
      });
      setRoom(next);
      setRotatedNote(true);
      setModalOpen(false);
    } catch {
      setError('Rotating the room failed — try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  const download = useCallback(async () => {
    if (!room) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/scene-collection', { method: 'POST' });
      if (!res.ok) {
        throw new Error(`${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bumbleflies-Live-${room.room}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Downloading the scene collection failed — try again.');
    } finally {
      setBusy(false);
    }
  }, [room]);

  const logout = useCallback(async () => {
    await fetch('/auth/logout', { method: 'POST' });
    window.location.reload();
  }, []);

  return (
    <>
      <header className="page-header">
        <div className="brand">
          bumble<span className="accent">:live</span>
        </div>
        <div className="user-email">
          {user.email}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              void logout();
            }}
          >
            sign out
          </a>
        </div>
      </header>
      {rotatedNote && (
        <p className="rotate-note">
          Room rotated. Links you sent before are dead — send the new ones, and re-import
          the freshly downloaded scene collection into OBS (one time).
          <button className="copy-btn" onClick={() => setRotatedNote(false)}>
            dismiss
          </button>
        </p>
      )}
      {room && (
        <>
          <div className="actions">
            <button className="btn" onClick={download} disabled={busy}>
              Download OBS scene collection
            </button>
            <button
              className="btn btn-danger"
              onClick={() => setModalOpen(true)}
              disabled={busy}
            >
              Rotate room…
            </button>
            <a className="btn" href={room.director} target="_blank" rel="noreferrer">
              Open director
            </a>
          </div>
          <p className="credentials">
            room: <b>{room.room}</b> · password: <b>{room.password}</b> · links are
            permanent — share once, then keep them pinned.
          </p>
          <section className="windows">
            <h2>
              Stream monitor{' '}
              <TooltipStar>
                The same feeds OBS consumes, laid out like the OBS scenes. Pick a Focus
                mode to watch one person; “Join as …” opens your own publish window to go
                on camera right here.
              </TooltipStar>
            </h2>
            <SceneSwitcher room={room} />
            <div className="join-row">
              {room.guests.map((g) => (
                <button key={g.name} className="btn" onClick={() => setJoinName(g.name as WindowName)}>
                  Join as {g.name}
                </button>
              ))}
              <button className="btn" onClick={() => setJoinName('Guest')}>
                Join as Guest
              </button>
              <button className="btn" onClick={() => setJoinName('Screen')}>
                Share screen
              </button>
            </div>
          </section>
          <section>
            <h2>
              Guest access links{' '}
              <TooltipStar>
                For people outside bumbleflies. Each link opens this site in guest mode,
                bound to one person: they can join and control the room via the director —
                but they cannot manage it, and the bumbleflies tools stay behind the
                Google gate. Handle them like keys; rotating the room revokes all of them.
              </TooltipStar>
            </h2>
            <div className="share-row">
              {room.guests.map((g) => (
                <CopyBtn
                  key={g.name}
                  text={buildShareUrl(window.location.origin, {
                    room: room.room,
                    password: room.password,
                    person: g.name,
                  })}
                  label={`Copy guest link · ${g.name}`}
                />
              ))}
              <CopyBtn
                text={buildShareUrl(window.location.origin, {
                  room: room.room,
                  password: room.password,
                  person: 'Guest',
                })}
                label="Copy guest link · Guest"
              />
              <CopyBtn
                text={buildShareUrl(window.location.origin, {
                  room: room.room,
                  password: room.password,
                  person: 'Screen',
                })}
                label="Copy guest link · Screen"
              />
            </div>
          </section>
          <div className="result">
            <section>
              <h2>Links</h2>
              {room.guests.map((g) => (
                <div key={g.name}>
                  <h3>
                    {g.name} <TooltipStar>{g.warning ?? ''}</TooltipStar>
                  </h3>
                  <LinkRow label={`Host ${g.name}`} link={g.link} />
                </div>
              ))}
              <h3>
                External guest <TooltipStar>{room.externalGuest.warning}</TooltipStar>
              </h3>
              <LinkRow label="Guest (external)" link={room.externalGuest.link} />
              <h3>
                Screen share <TooltipStar>{room.screenShare.warning ?? ''}</TooltipStar>
              </h3>
              <LinkRow label="Screen share" link={room.screenShare.guestLink} />
            </section>
            <section>
              <h2>
                OBS view links{' '}
                <TooltipStar>
                  Browser Source, 1920x1080. All five are baked into the downloadable scene
                  collection — these links are only for manual repair.
                </TooltipStar>
              </h2>
              {room.obsSources.map((s) => (
                <LinkRow key={s.name} label={`OBS source ${s.name}`} link={s.link} />
              ))}
              <LinkRow label="OBS source Screen" link={room.screenShare.obsLink} />
            </section>
          </div>
        </>
      )}
      {error && <p className="error">{error}</p>}
      <p className="hint">
        OBS needs one manual step ever: Scene Collection &gt; Import with the downloaded
        file. After that, every session reuses the same links.
      </p>
      {modalOpen && (
        <ConfirmRotateModal
          busy={busy}
          onCancel={() => setModalOpen(false)}
          onConfirm={rotate}
        />
      )}
      {joinName && !modalOpen && room && (
        <JoinWindow
          name={joinName}
          link={
            joinName === 'Screen'
              ? room.screenShare.guestLink
              : joinName === 'Guest'
                ? room.externalGuest.link
                : room.guests.find((g) => g.name === joinName)!.link
          }
          onClose={() => setJoinName(null)}
        />
      )}
    </>
  );
}

function GuestView({ share }: { share: { room: string; password: string; person?: string } }) {
  const room = buildFacadeRoom(share.room, share.password);
  const [joinName, setJoinName] = useState<WindowName | null>(
    (share.person as WindowName) ?? null,
  );
  const leave = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    history.replaceState(null, '', window.location.pathname);
    window.location.reload();
  }, []);

  return (
    <>
      <header className="page-header">
        <div className="brand">
          bumble<span className="accent">:live</span>
        </div>
        <div className="guest-chip">
          guest access{share.person ? ` · ${share.person}` : ''}
          <a href="#" onClick={leave}>
            leave
          </a>
        </div>
      </header>
      <div className="windows">
        <section>
          <h2>
            Your window
            {joinName ? ` · ${joinName === 'Screen' ? 'Share screen' : joinName}` : ''}{' '}
            <TooltipStar>
              Allow camera and microphone when asked. Background blur does not work via the
              link — enable it after joining, via the camera/video icon toolbar. Headphones
              strongly recommended (echoes otherwise).
            </TooltipStar>
          </h2>
          {joinName ? (
            <div className="scene-panel">
              <iframe
                key={joinName}
                src={joinName === 'Screen' ? room.screenShare.guestLink : room.guests.find((g) => g.name === joinName)?.link ?? room.externalGuest.link}
                title={`Publish window ${joinName}`}
                allow={IFRAME_ALLOW}
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="join-row">
              <p className="hint">Pick who you are to open your camera window:</p>
              {room.guests.map((g) => (
                <button key={g.name} className="btn" onClick={() => setJoinName(g.name as WindowName)}>
                  Join as {g.name}
                </button>
              ))}
              <button className="btn" onClick={() => setJoinName('Guest')}>
                Join as Guest
              </button>
              <button className="btn" onClick={() => setJoinName('Screen')}>
                Share screen
              </button>
            </div>
          )}
          {joinName && (
            <div className="window-foot">
              <a
                href={
                  joinName === 'Screen'
                    ? room.screenShare.guestLink
                    : room.guests.find((g) => g.name === joinName)?.link ?? room.externalGuest.link
                }
                target="_blank"
                rel="noreferrer"
              >
                open in new tab
              </a>
              <button className="copy-btn" onClick={() => setJoinName(null)}>
                switch person
              </button>
            </div>
          )}
        </section>
        <section>
          <h2>Watch the show</h2>
          <SceneSwitcher room={room} />
        </section>
        <section>
          <h2>
            Control the show{' '}
            <TooltipStar>
              The director lets you mute, spotlight and solo people — the production side of
              the room. You do not get room or OBS management: those stay with the bumbleflies
              team.
            </TooltipStar>
          </h2>
          <a className="btn btn-primary" href={room.director} target="_blank" rel="noreferrer">
            Open director (room control)
          </a>
        </section>
      </div>
      <p className="hint">
        Guest access: your link is personal — do not forward it. The bumbleflies team can
        revoke access by rotating the room.
      </p>
    </>
  );
}

function PublicLanding() {
  const [code, setCode] = useState('');
  const [failed, setFailed] = useState(false);
  const open = useCallback(() => {
    const share = parseAccessCode(code);
    if (!share) {
      setFailed(true);
      return;
    }
    history.replaceState(null, '', buildShareHash(share));
    window.location.reload();
  }, [code]);
  return (
    <div className="signin">
      <h1>
        bumble<span className="accent">:live</span>
      </h1>
      <p>
        Bumbleflies' live show. On air via VDO.Ninja + OBS. Members manage the room here;
        show guests get personal access links.
      </p>
      <a className="btn btn-primary" href="/auth/google">
        Sign in with Google
      </a>
      <p className="hint">bumbleflies.de accounts only.</p>
      <div className="access-entry">
        <label htmlFor="access-code">Got a personal access link? Paste it here:</label>
        <textarea
          id="access-code"
          rows={2}
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setFailed(false);
          }}
          placeholder="https://live.bumbleflies.de/#r=…&p=…&person=…"
        />
        <div className="access-actions">
          <button className="btn" onClick={open} disabled={!code.trim()}>
            Open access link
          </button>
          {failed && <span className="error">That does not look like an access link.</span>}
        </div>
      </div>
    </div>
  );
}

function App() {
  // Hash = guest capability. It wins over the member session: someone opening
  // their own share link expects the guest view. Leaving is one click.
  const [share, setShare] = useState(() => parseShareHash(window.location.hash));
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onHash = () => setShare(parseShareHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    fetch('/auth/me')
      .then((res) => (res.ok ? (res.json() as Promise<{ user: User }>) : Promise.reject()))
      .then((data) => {
        setUser(data.user);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (share) {
    return <GuestView share={share} />;
  }
  if (!loaded) {
    return null;
  }
  if (!user) {
    return <PublicLanding />;
  }
  return <Generator user={user} />;
}

const page = document.createElement('div');
page.className = 'page';
document.body.appendChild(page);
createRoot(page).render(<App />);
