import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Garba Friend Finder',
        short_name: 'GarbaFinder',
        description: 'Find your friends and family at the Garba ground',
        theme_color: '#e8590c',
        background_color: '#fff7ee',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        // Cache map tiles (any host) so the map still works with no internet
        runtimeCaching: [{
          urlPattern: ({ url }) => /\/\d{1,2}\/\d+\/\d+(\.png|\.jpg|\.webp)?$/.test(url.pathname),
          handler: 'CacheFirst',
          options: {
            cacheName: 'map-tiles',
            expiration: { maxEntries: 4000, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] }
          }
        }]
      }
    })
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': { target: 'ws://localhost:8080', ws: true }
    }
  }
});
