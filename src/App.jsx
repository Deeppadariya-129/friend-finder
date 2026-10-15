import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapView from './MapView.jsx';
import { useGeo, useGroup, useWakeLock } from './hooks';
import { downloadOfflineMap } from './offline';
import { API_URL, STALE_SEC } from './config';
import { bearing, compass, distance, fmtAge, fmtDist } from './utils';

const load = () => { try { return JSON.parse(localStorage.getItem('garba-session')); } catch { return null; } };
const uid = () => localStorage.getItem('garba-uid') ||
  (localStorage.setItem('garba-uid', crypto.randomUUID()), localStorage.getItem('garba-uid'));

export default function App() {
  const [sess, setSess] = useState(load);
  const join = (s) => { localStorage.setItem('garba-session', JSON.stringify(s)); setSess(s); };
  const leave = () => { localStorage.removeItem('garba-session'); setSess(null); };
  return sess ? <Room sess={sess} onLeave={leave} /> : <Join onJoin={join} />;
}

function Join({ onJoin }) {
  const [name, setName] = useState(localStorage.getItem('garba-name') || '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const go = async (c) => {
    if (!name.trim()) return setErr('Please enter your name');
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${API_URL}/api/group/${c}`).then((x) => x.json());
      if (!r.exists) throw new Error('Group code not found');
      localStorage.setItem('garba-name', name.trim());
      onJoin({ code: c, name: name.trim(), id: uid() });
    } catch (e) { setErr(e.message || 'No connection'); }
    setBusy(false);
  };
  const create = async () => {
    if (!name.trim()) return setErr('Please enter your name');
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${API_URL}/api/group`, { method: 'POST' }).then((x) => x.json());
      await go(r.code);
    } catch { setErr('No connection. Create the group before the event, while online.'); setBusy(false); }
  };

  return (
    <div className="join">
      <h1>🪔 Garba Friend Finder</h1>
      <p>Find friends and family at the ground.</p>
      <input placeholder="Your name" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
      <button className="primary" disabled={busy} onClick={create}>Create new group</button>
      <div className="or">or join with a code</div>
      <input placeholder="GROUP CODE" value={code} maxLength={6} className="code"
        onChange={(e) => setCode(e.target.value.toUpperCase())} />
      <button disabled={busy || code.length < 6} onClick={() => go(code)}>Join group</button>
      {err && <p className="err">{err}</p>}
    </div>
  );
}

function Room({ sess, onLeave }) {
  const { code, name, id } = sess;
  const { pos, moving: meMoving, err } = useGeo();
  const { members, online, error, sendLoc, sendSos, leave } = useGroup({ code, name, id });
  const [selected, setSelected] = useState(null);
  const [sos, setSos] = useState(false);
  const [follow, setFollow] = useState(true);
  const [dl, setDl] = useState(null);
  const [now, setNow] = useState(Date.now());
  useWakeLock();

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // send my position: when I move > 8 m or every 10 s (small payload, works on weak signal)
  const lastSent = useRef(null);
  useEffect(() => {
    if (!pos) return;
    const l = lastSent.current;
    if (!l || pos.ts - l.ts > 10000 || distance(l, pos) > 8) { lastSent.current = pos; sendLoc(pos); }
  }, [pos, sendLoc]);

  const friends = useMemo(() => members
    .filter((m) => m.id !== id && m.lat != null)
    .map((m) => {
      const age = Math.max(0, (now - m.ts) / 1000);
      const d = pos ? distance(pos, m) : null;
      return { ...m, age, stale: age > STALE_SEC, moving: now - m.movedAt < 15000 && age < STALE_SEC,
        dist: d, dir: pos ? compass(bearing(pos, m)) : '' };
    })
    .sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0)), [members, now, pos, id]);

  const waiting = members.filter((m) => m.id !== id && m.lat == null);
  const select = useCallback((i) => setSelected((s) => (s === i ? null : i)), []);

  const toggleSos = () => { const v = !sos; setSos(v); sendSos(v); };
  const share = async () => {
    const text = `Join my Garba group on Garba Finder. Code: ${code}\n${location.origin}`;
    try { navigator.share ? await navigator.share({ text }) : await navigator.clipboard.writeText(text); } catch {}
  };
  const download = async () => { setDl([0, 1]); await downloadOfflineMap((a, b) => setDl([a, b]), pos ? [pos.lat, pos.lng] : undefined); setTimeout(() => setDl(null), 2500); };
  const exit = () => { leave(); onLeave(); };

  return (
    <div className="room">
      <header>
        <button className="code-chip" onClick={share} title="Share code">Group {code} ⤴</button>
        <span className={`st ${online ? 'ok' : 'off'}`}>{online ? 'Online' : 'Offline – will resend'}</span>
        <button onClick={exit}>Leave</button>
      </header>

      <div className="mapbox">
        <MapView me={pos} meMoving={meMoving} friends={friends} selectedId={selected}
          onSelect={select} followMe={follow && !selected} />
        <div className="tools">
          <button onClick={() => { setSelected(null); setFollow(true); }}>📍</button>
          <button onClick={download}>{dl ? `${Math.round((dl[0] / dl[1]) * 100)}%` : '⬇️'}</button>
        </div>
        {(err || error) && <div className="banner">{err || error}</div>}
        {!pos && !err && <div className="banner">Getting your GPS location…</div>}
      </div>

      <section className="sheet">
        <div className="me-row">
          <span className="d me" /> <b>You</b>
          <small>{pos ? `GPS ±${pos.acc} m` : 'searching…'}</small>
          <span className={`tag ${meMoving ? 'm' : ''}`}>{meMoving ? 'moving' : 'standing'}</span>
        </div>

        {friends.map((f) => (
          <div key={f.id} className={`row ${selected === f.id ? 'sel' : ''} ${f.sos ? 'sos' : ''}`} onClick={() => select(f.id)}>
            <span className="d" style={{ background: f.color }} />
            <b>{f.name}{f.sos && ' 🆘'}</b>
            <small>
              {f.dist != null ? `${fmtDist(f.dist)} ${f.dir}` : ''}
              {f.stale ? ` · seen ${fmtAge(f.age)}` : ''}
            </small>
            <span className={`tag ${f.moving ? 'm' : ''}`}>{f.stale ? 'last seen' : f.moving ? 'moving' : 'standing'}</span>
          </div>
        ))}
        {waiting.map((f) => <div key={f.id} className="row wait"><span className="d" style={{ background: f.color }} /><b>{f.name}</b><small>waiting for GPS…</small></div>)}
        {!friends.length && !waiting.length && <p className="empty">No friends yet. Tap “Group {code}” to share the code.</p>}

        <button className={`sos-btn ${sos ? 'on' : ''}`} onClick={toggleSos}>
          {sos ? 'Cancel SOS' : '🆘 I need help / I am lost'}
        </button>
      </section>
    </div>
  );
}
