import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GROUND, TILE_URL } from './config';

const pin = (name, color, cls = '') =>
  L.divIcon({
    className: 'pin-wrap',
    iconSize: [0, 0],
    html: `<div class="pin ${cls}" style="--c:${color}"><i class="halo"></i><i class="core"></i><b class="nm">${name.replace(/[<>&"]/g, '')}</b></div>`,
  });

export default function MapView({ me, meMoving, friends, selectedId, onSelect, followMe }) {
  const box = useRef(), map = useRef(), meMk = useRef(), mks = useRef({}), line = useRef(), first = useRef(true);

  useEffect(() => {
    const m = L.map(box.current, { zoomControl: false }).setView(GROUND.center, GROUND.zoom);
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
    map.current = m;
    return () => m.remove();
  }, []);

  // my dot
  useEffect(() => {
    if (!me) return;
    const ll = [me.lat, me.lng];
    if (!meMk.current) {
      meMk.current = L.marker(ll, { icon: pin('You', '#1a73e8'), zIndexOffset: 1000 }).addTo(map.current);
    } else meMk.current.setLatLng(ll);
    meMk.current.getElement()?.querySelector('.pin')?.classList.toggle('moving', meMoving);
    if (first.current) { map.current.setView(ll, 18); first.current = false; }
    else if (followMe) map.current.panTo(ll);
  }, [me, meMoving, followMe]);

  // friends' dots
  useEffect(() => {
    const ids = new Set(friends.map((f) => f.id));
    Object.keys(mks.current).forEach((id) => { if (!ids.has(id)) { mks.current[id].remove(); delete mks.current[id]; } });
    friends.forEach((f) => {
      const ll = [f.lat, f.lng];
      let mk = mks.current[f.id];
      if (!mk) {
        mk = L.marker(ll, { icon: pin(f.name, f.color) }).addTo(map.current);
        mk.on('click', () => onSelect(f.id));
        mks.current[f.id] = mk;
      } else mk.setLatLng(ll);
      const el = mk.getElement()?.querySelector('.pin');
      if (el) {
        el.classList.toggle('moving', f.moving);
        el.classList.toggle('stale', f.stale);
        el.classList.toggle('sos', !!f.sos);
        el.classList.toggle('sel', f.id === selectedId);
      }
    });
  }, [friends, selectedId, onSelect]);

  // line to the selected friend
  useEffect(() => {
    line.current?.remove(); line.current = null;
    const f = friends.find((x) => x.id === selectedId);
    if (f && me) line.current = L.polyline([[me.lat, me.lng], [f.lat, f.lng]],
      { color: '#1a73e8', weight: 3, dashArray: '6 6' }).addTo(map.current);
  }, [selectedId, friends, me]);

  // fly to selected friend
  useEffect(() => {
    const f = friends.find((x) => x.id === selectedId);
    if (f) map.current.flyTo([f.lat, f.lng], Math.max(map.current.getZoom(), 18), { duration: 0.6 });
    // eslint-disable-next-line
  }, [selectedId]);

  return <div ref={box} className="map" />;
}

