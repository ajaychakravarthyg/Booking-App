import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Proxy /api to the gateway in development. This keeps the browser on a single
    // origin so CORS never enters the picture locally, and it means the dev build
    // uses the same relative URLs as production.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Recharts alone is ~537 kB. That is deliberate and already isolated: the chart
    // bundle is only fetched when an admin opens the dashboard, so a guest browsing
    // rooms downloads ~150 kB. Raised so a known, intentional split does not emit a
    // warning on every build.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          recharts: ['recharts'],
        },
      },
    },
  },
})
