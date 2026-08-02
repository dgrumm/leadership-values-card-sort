# Values Cards 2.0

Configurable multiplayer card-sorting exercise engine. Participants swipe through a deck
across elimination rounds (default: 40 → 8 → 3), reveal results to a shared wall, and export
a designed artifact. Facilitators compose the game: rounds, deck, art, pacing.

**This is the v2 rebuild.** v1 lives in git history (tag `v1-final`). The plan of record:
- [Validated Design](docs/plans/2026-08-02-values-cards-2.0-design.md)
- [PRD](docs/plans/2026-08-02-values-cards-2.0-prd.md) — feature specs decompose from §8
- [Architecture Plan](docs/plans/2026-08-02-values-cards-2.0-architecture.md)

## Stack
- **Client**: Vite + React 19 + TypeScript (strict), Tailwind v4 (`@theme` tokens), Framer Motion, Zustand
- **Server**: Cloudflare Durable Objects (one per session) + Worker routes; local dev via `wrangler dev` (Miniflare, no account needed)
- **Contracts**: Zod schemas in `shared/` — parsed at every boundary, client and server
- **Tests**: Vitest (+ fast-check for the engine/reducer), Playwright E2E
- **Export**: satori → resvg (PNG), pdf-lib (PDF) — never html2canvas

## Repo layout
```
app/      # Vite React SPA
party/    # Durable Object session server + Worker routes
shared/   # Zod schemas, game engine, contrast math — pure, no I/O
decks/    # bundled decks (JSON) + CSV→JSON authoring script
specs/    # feature specs (ralph units) + status.json (generated, never hand-edited)
docs/     # design/PRD/architecture, ADRs
```

## Architecture tenets (non-negotiable; each one is a lesson v1 paid for)
1. **One writer.** The session DO owns all shared state. Clients send intents with `intentId`
   (idempotent); they never write shared state directly.
2. **Privacy by architecture.** Unrevealed card choices never leave the device. The server
   cannot leak what it never receives.
3. **Identity is opaque.** Server-issued participant UUIDs. Display names are labels, never keys.
4. **Config over code.** One round-reduction engine driven by validated `GameConfig`. No
   per-step pages or per-step stores.
5. **Tokens or it doesn't merge.** All color/spacing/z-index/motion via `@theme` tokens in
   `app/src/theme/`. CI lint fails raw palette classes, hex literals, or inline z-index
   elsewhere in `app/src/`.
6. **Reconnect = resync.** On rejoin the DO sends a full state snapshot. No event replay or
   client-side reconciliation.

## Development process (ralph per feature, gated)
1. Pick the next spec from `specs/` in dependency order (check `specs/status.json`).
2. Work in a worktree on branch `feature/<spec-id>` (e.g. `feature/01-3-sort-loop`).
3. Loop: implement → `pnpm gate` → self-review against the spec's acceptance checklist →
   iterate until green.
4. Update status via `pnpm spec:status` (script-generated — never hand-edit status).
5. PR to `v2` titled `feat(<spec-id>): <description>` with spec link, checked criteria, and
   test evidence. Human review is the checkpoint.

**Gates (all must pass before any PR):**
```bash
pnpm gate          # typecheck + lint + unit + affected E2E
pnpm test:unit     # Vitest (default-include globs — new test files always run)
pnpm test:e2e      # Playwright
```

## Rules
- Never commit secrets. Ably taught us this the hard way — no `*_KEY` in client-reachable code;
  tokens are issued server-side.
- Never weaken or skip a failing test to get green; fix the implementation.
- Test discovery is include-by-default. Never add testMatch whitelists.
- Accessibility is a gate, not polish: keyboard equivalents for every pointer interaction,
  focus-trapped modals, `prefers-reduced-motion` honored via the shared motion wrapper.
- Don't start a spec whose dependencies aren't merged.
- Node ≥ 22 (`nvm use` honors `.nvmrc`). pnpm only.

## Product invariants (PRD §6 — these have automated tests; keep them green)
1. Unrevealed choices are never transmitted or stored server-side.
2. Reveal snapshots are write-once; un-reveal deletes, never edits.
3. Keep-count constraints enforced server-side on reveal payloads.
4. Refresh/reconnect never loses local sort progress or membership.
5. Replayed intents are no-ops.
6. All theme colors — including adaptive palettes — pass WCAG AA.
