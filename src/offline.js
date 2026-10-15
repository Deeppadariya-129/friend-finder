import { GROUND, TILE_URL } from './config';
import { tileX, tileY } from './utils';

// Fetch the tiles around the ground once (while online) so the service worker caches them.
// Small area + short pauses = polite to the free OpenStreetMap servers.
export async function downloadOfflineMap(onProgress, center = GROUND.center) {
  const [lat, lng] = center, d = GROUND.radiusDeg;
  const urls = [];
  for (let z = 16; z <= 19; z++) {
    const x1 = tileX(lng - d, z), x2 = tileX(lng + d, z);
    const y1 = tileY(lat + d, z), y2 = tileY(lat - d, z);
    for (let x = x1; x <= x2; x++)
      for (let y = y1; y <= y2; y++)
        urls.push(TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{s}', 'a'));
  }
  for (let i = 0; i < urls.length; i += 4) {
    await Promise.all(urls.slice(i, i + 4).map((u) => fetch(u, { mode: 'no-cors' }).catch(() => {})));
    onProgress(Math.min(urls.length, i + 4), urls.length);
    await new Promise((r) => setTimeout(r, 150));
  }
}
