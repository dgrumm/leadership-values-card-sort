import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 00.6: the active pack is a build-time constant (packs/index.ts), not per-session
// config. `VITE_PACK` lets `pnpm gate` run the full suite once per pack without
// hand-editing that constant; both this alias and packs/index.ts's own default read
// the same env var, so the CSS bundled here and the values validated in tests always
// agree on which pack is active.
const ACTIVE_PACK = process.env['VITE_PACK'] ?? 'tactile-warm';

// The session DO lives in `party/` (wrangler dev — playwright.config.ts starts it on
// a dedicated port, avoiding wrangler's shared 8787 default) — proxied under /api so
// the app only ever talks to one origin (same-origin WebSocket upgrade included).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // tokens.css imports this bare specifier — only the active pack's CSS (and
      // therefore only its @import'd font) ever enters the module graph.
      '@active-pack': fileURLToPath(
        new URL(`./src/theme/packs/${ACTIVE_PACK}.css`, import.meta.url),
      ),
    },
  },
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
