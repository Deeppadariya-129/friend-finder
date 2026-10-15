import { useCallback, useEffect, useRef, useState } from 'react';
import { WS_URL, MOVING_M } from './config';
import { distance } from './utils';

// ---- GPS (works with no internet) ----
export function useGeo() {
  const [pos, setPos] = useState(null);
  const [moving, setMoving] = useState(false);
  const [err, setErr] = useState('');
  const prev = useRef(null);
  const movedAt = useRef(0);

  useEffect(() => {
    if (!navigator.geolocation) return setErr('GPS not supported on this phone');
    const wid = navigator.geolocation.watchPosition(
      (p) => {
        const v = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy), ts: Date.now() };
        if (prev.current && distance(prev.current, v) > 2) movedAt.current = Date.now();
        prev.current = v;
        setPos(v); setErr('');
      },
      (e) => setErr(e.code === 1 ? 'Location permission denied' : e.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
    );
    const t = setInterval(() => setMoving(Date.now() - movedAt.current < 8000), 1000);
    return () => { navigator.geolocation.clearWatch(wid); clearInterval(t); };
  }, []);

  return { pos, moving, err };
}

// ---- keep the screen on so tracking keeps running ----
export function useWakeLock() {
  useEffect(() => {
    let lock;
    const get = async () => { try { lock = await navigator.wakeLock?.request('screen'); } catch {} };
    get();
    const vis = () => document.visibilityState === 'visible' && get();
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); lock?.release?.(); };
  }, []);
}

// ---- WebSocket group connection with auto-reconnect ----
export function useGroup({ code, name, id }) {
  const [members, setMembers] = useState([]);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState('');
  const ws = useRef(null);
  const latest = useRef(null); // last position (store-and-forward: sent as soon as we reconnect)
  const sos = useRef(false);
  const movedAt = useRef({});  // id -> last time its position changed
  const lastPos = useRef({});

  useEffect(() => {
    let closed = false, retry = 0, timer;
    const connect = () => {
      const s = new WebSocket(WS_URL);
      ws.current = s;
      s.onopen = () => {
        retry = 0; setOnline(true);
        s.send(JSON.stringify({ t: 'join', code, name, id }));
        if (latest.current) s.send(JSON.stringify({ t: 'loc', ...latest.current }));
        if (sos.current) s.send(JSON.stringify({ t: 'sos', on: true }));
      };
      s.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.t === 'error') return setError(m.msg);
        if (m.t === 'joined' || m.t === 'state') {
          const now = Date.now();
          m.state.forEach((f) => {
            const p = lastPos.current[f.id];
            if (p && f.lat != null && distance(p, f) > MOVING_M) movedAt.current[f.id] = now;
            if (f.lat != null) lastPos.current[f.id] = { lat: f.lat, lng: f.lng };
          });
          setMembers(m.state.map((f) => ({ ...f, movedAt: movedAt.current[f.id] || 0 })));
        }
      };
      s.onclose = () => {
        setOnline(false);
        if (!closed) timer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 15000));
      };
    };
    connect();
    return () => { closed = true; clearTimeout(timer); ws.current?.close(); };
  }, [code, name, id]);

  const sendLoc = useCallback((p) => {
    latest.current = p;
    if (ws.current?.readyState === 1) ws.current.send(JSON.stringify({ t: 'loc', ...p }));
  }, []);

  const sendSos = useCallback((on) => {
    sos.current = on;
    if (ws.current?.readyState === 1) ws.current.send(JSON.stringify({ t: 'sos', on }));
  }, []);

  const leave = useCallback(() => {
    if (ws.current?.readyState === 1) ws.current.send(JSON.stringify({ t: 'leave' }));
  }, []);

  return { members, online, error, sendLoc, sendSos, leave };
}
