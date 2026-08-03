import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The session DO lives in `party/` (wrangler dev — playwright.config.ts starts it on
// a dedicated port, avoiding wrangler's shared 8787 default) — proxied under /api so
// the app only ever talks to one origin (same-origin WebSocket upgrade included).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Pin the port and fail loudly if it's taken, rather than silently drifting to 5174+
    // when another Vite project is already on 5173 — a silent drift means the browser tab
    // and the app end up on different servers, which reads as "nothing works". README
    // documents :5173. (Playwright overrides this via `--port 5199 --strictPort`.)
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8799', changeOrigin: true, ws: true },
    },
  },
});
