import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

interface GuestLink {
  name: string;
  link: string;
  warning?: string;
}

interface ObsSource {
  name: string;
  link: string;
}

interface Room {
  room: string;
  password: string;
  director: string;
  guests: GuestLink[];
  obsSources: ObsSource[];
  screenShare: { guestLink: string; obsLink: string; warning?: string };
}

interface User {
  email: string;
}

const WINDOW_NAMES = ['Nico', 'Sebi', 'Chris', 'Screen'] as const;
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
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [link]);
  return (
    <div className="link-row">
      <span className="link-label">{label}</span>
      <a className="link-value" href={link} target="_blank" rel="noreferrer">
        {link}
      </a>
      <button className={`copy-btn${copied ? ' copied' : ''}`} onClick={copy}>
        {copied ? 'copied' : 'copy'}
      </button>
    </div>
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

function StreamWindow({ name, link }: { name: WindowName; link: string }) {
  const [shown, setShown] = useState(false);
  const label = name === 'Screen' ? 'Screen (backup slot)' : name;
  return (
    <div className="window-card">
      <div className="window-head">
        <span className="window-label">{label}</span>
        <button
          className={shown ? 'copy-btn' : 'copy-btn copied'}
          onClick={() => setShown(!shown)}
        >
          {shown ? 'hide' : 'join'}
        </button>
      </div>
      {shown ? (
        <iframe
          className="window-iframe"
          src={link}
          title={`${label} stream window`}
          allow={IFRAME_ALLOW}
          referrerPolicy="no-referrer"
        />
      ) : (
        <p className="hint">
          Your streaming window right here — press join, allow camera and microphone.
        </p>
      )}
      <div className="window-foot">
        <a href={link} target="_blank" rel="noreferrer">
          open in new tab
        </a>
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
          bumble<span className="accent">live</span>
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
            <h2>Stream windows</h2>
            <p className="warning">
              <span className="warn-star">* </span>
              Each person opens their own card, allows camera and microphone, and is in
              the room — no separate tab. If the embedded window misbehaves (Safari/iOS),
              use “open in new tab”.
            </p>
            <div className="windows-grid">
              {room.guests.map((g) => (
                <StreamWindow key={g.name} name={g.name as WindowName} link={g.link} />
              ))}
              <StreamWindow name="Screen" link={room.screenShare.guestLink} />
            </div>
          </section>
          <div className="result">
            <section>
              <h2>Links</h2>
              {room.guests.map((g) => (
                <div key={g.name}>
                  <h3>{g.name}</h3>
                  {g.warning && (
                    <p className="warning">
                      <span className="warn-star">* </span>
                      {g.warning}
                    </p>
                  )}
                  <LinkRow label={`Guest ${g.name}`} link={g.link} />
                </div>
              ))}
              <h3>Screen share</h3>
              {room.screenShare.warning && (
                <p className="warning">
                  <span className="warn-star">* </span>
                  {room.screenShare.warning}
                </p>
              )}
              <LinkRow label="Guest Screen (backup slot)" link={room.screenShare.guestLink} />
            </section>
            <section>
              <h2>OBS view links</h2>
              <p className="warning">
                <span className="warn-star">* </span>
                Browser Source, 1920x1080. All four are baked into the downloadable scene
                collection — these links are only for manual repair.
              </p>
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
    </>
  );
}

function SignedOut() {
  return (
    <div className="signin">
      <h1>
        bumble<span className="accent">:live</span> room setup
      </h1>
      <p>Your permanent VDO.Ninja room, stream windows, and OBS scene collection.</p>
      <a className="btn btn-primary" href="/auth/google">
        Sign in with Google
      </a>
      <p className="hint">bumbleflies.de accounts only.</p>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/auth/me')
      .then((res) => (res.ok ? (res.json() as Promise<{ user: User }>) : Promise.reject()))
      .then((data) => {
        setUser(data.user);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return null;
  }
  if (!user) {
    return <SignedOut />;
  }
  return <Generator user={user} />;
}

const page = document.createElement('div');
page.className = 'page';
document.body.appendChild(page);
createRoot(page).render(<App />);
