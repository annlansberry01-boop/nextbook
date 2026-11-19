import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Next Book',
        short_name: 'Next Book',
        description: 'Log, rate and choose your next book.',
        theme_color: '#111113',
        background_color: '#111113',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  // host: true lets your phone open the app over the same wifi.
  server: { host: true, port: 5173 },
})
