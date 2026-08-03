import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The session DO lives in `party/` (wrangler dev — playwright.config.ts starts it on
// a dedicated port, avoiding wrangler's shared 8787 default) — proxied under /api so
// the app only ever talks to one origin (same-origin WebSocket upgrade included).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:8799', changeOrigin: true, ws: true },
    },
  },
});
