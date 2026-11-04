import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Form – Antrenman & Beslenme',
        short_name: 'Form',
        lang: 'tr',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#0d1117',
        theme_color: '#0d1117',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, handler: 'CacheFirst', options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 31536000 } } },
          { urlPattern: /^https:\/\/world\.openfoodfacts\.org\/.*/, handler: 'NetworkFirst', options: { cacheName: 'off', networkTimeoutSeconds: 6, expiration: { maxEntries: 300, maxAgeSeconds: 2592000 } } }
        ]
      }
    })
  ]
})
