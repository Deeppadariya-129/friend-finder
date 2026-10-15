// >>> CHANGE THIS to your Garba ground (right-click the ground in Google Maps -> copy lat,lng) <<<
export const GROUND = {
  center: [22.268919, 73.160663], // [lat, lng] of the ground centre
  zoom: 19,
  radiusDeg: 0.0015,           // ~330 m each side: area saved by the "download offline map" button
};

// Free OpenStreetMap tiles. Fine for a small group of friends & family (light use).
export const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const API_URL = import.meta.env.VITE_API_URL || '';
export const WS_URL = import.meta.env.VITE_WS_URL ||
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

export const STALE_SEC = 45;   // after this a friend shows as faded "last seen"
export const MOVING_M = 4;     // moved more than this between updates => "moving"
