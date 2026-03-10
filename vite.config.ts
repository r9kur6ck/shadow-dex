import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Shadow Dex',
        short_name: 'ShadowDex',
        description: 'Secure local dictionary and note app',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5000000 // Raise the limit to 5MB for BlockNote chunks
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'blocknote': ['@blocknote/core', '@blocknote/react', '@blocknote/mantine'],
          'vendor': ['react', 'react-dom', 'dexie', 'dexie-react-hooks']
        }
      }
    }
  },
  server: {
    host: true
  }
})
