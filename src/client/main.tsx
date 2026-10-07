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

function Generator({ user }: { user: User }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setRoom(await api<Room>('/api/room', { method: 'POST' }));
    } catch {
      setError('Generating a room failed — try again.');
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
      setError('Downloading the scene collection failed — generate a room first.');
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
      <div className="actions">
        <button className="btn btn-primary" onClick={generate} disabled={busy}>
          Generate new room
        </button>
        <button className="btn" onClick={download} disabled={busy || !room}>
          Download OBS scene collection
        </button>
      </div>
      {room && (
        <div className="result">
          <p className="credentials">
            room: <b>{room.room}</b> · password: <b>{room.password}</b>
          </p>
          <section>
            <h2>Director</h2>
            <p className="warning">
              <span className="warn-star">* </span>
              Host only, keep private.
            </p>
            <LinkRow label="Director" link={room.director} />
          </section>
          <section>
            <h2>Guests</h2>
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
              Browser Source, 1920x1080. The camera sources are also baked into the
              downloadable scene collection.
            </p>
            {room.obsSources.map((s) => (
              <LinkRow key={s.name} label={`OBS source ${s.name}`} link={s.link} />
            ))}
            <LinkRow label="OBS source Screen" link={room.screenShare.obsLink} />
          </section>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <p className="hint">
        OBS still needs one manual step: Scene Collection &gt; Import with the downloaded
        file. The host flow lives in the bumble:live checklist.
      </p>
    </>
  );
}

function SignedOut() {
  return (
    <div className="signin">
      <h1>
        bumble<span className="accent">:live</span> room setup
      </h1>
      <p>Generate VDO.Ninja room links and the matching OBS scene collection.</p>
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
