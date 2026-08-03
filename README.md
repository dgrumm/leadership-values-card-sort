# Values Cards

A configurable, multiplayer card-sorting exercise. Swipe through a deck of values across
elimination rounds (classic: 40 → 8 → 3), reveal your result to a shared wall, and leave
with a beautiful export. Facilitators design the game itself — rounds, deck, art, pacing.

**Status: v2 rebuild in progress.**

## Running it locally

```bash
nvm use                              # Node >= 22
pnpm install
cp party/.dev.vars.example party/.dev.vars   # one-time: the DO needs a token-signing secret
```

Then two terminals:

```bash
cd app && pnpm dev      # http://localhost:5173
cd party && pnpm dev    # the session Durable Object on :8799
```

Vite proxies `/api` to the Durable Object, so use the app origin (`:5173`) in the browser —
not the wrangler port. The dev port is set once in `party/wrangler.jsonc`; if you change it,
change `app/vite.config.ts`'s proxy target and `playwright.config.ts` to match.

`party/.dev.vars` is gitignored and local-only. Without it, `POST /api/session` fails —
`SESSION_TOKEN_SECRET` signs the HMAC participant/creator tokens, so there is deliberately
no default.

- Plan of record: [design](docs/plans/2026-08-02-values-cards-2.0-design.md) ·
  [PRD](docs/plans/2026-08-02-values-cards-2.0-prd.md) ·
  [architecture](docs/plans/2026-08-02-values-cards-2.0-architecture.md)
- v1 (Next.js + Ably) is preserved in git history at tag
  [`v1-final`](../../tree/v1-final) — kept for lineage; this repo doubles as a
  before/after case study in spec-driven, loop-engineered development with Claude Code.
