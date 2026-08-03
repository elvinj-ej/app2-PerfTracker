import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Production build defaults to living under /PerfTracker (see backend URL_PREFIX
  // setting, app/main.py) so multiple internally-hosted apps can share a naming
  // convention like host:port/AppName. Override with VITE_BASE_PATH if the prefix
  // ever changes. The dev server always serves from root for simplicity.
  base: command === 'build' ? process.env.VITE_BASE_PATH || '/PerfTracker/' : '/',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
}))
