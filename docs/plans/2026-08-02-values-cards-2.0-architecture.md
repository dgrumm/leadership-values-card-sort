# Values Cards 2.0 — Architecture Plan

**Date:** 2026-08-02
**Status:** Draft for approval
**Companions:** [Validated Design](2026-08-02-values-cards-2.0-design.md) · [PRD](2026-08-02-values-cards-2.0-prd.md)

---

## 1. Design tenets (lessons paid for by v1)

1. **One writer.** All shared state is owned by a single session actor. Clients send intents;
   they never write shared state. (v1: four writers, last-write-wins presence, no merge.)
2. **Privacy by architecture.** Unrevealed card choices never reach the server, so no bug can
   leak them. (v1: privacy was a client-discipline convention.)
3. **Identity is opaque.** Server-issued UUIDs; display names are labels. (v1: name-derived
   IDs crashed on "Dave Smith" and spawned "Bob-2" ghosts.)
4. **Config over code.** Rounds/decks/themes are validated data interpreted by one engine.
   (v1: three ~850-line step pages, ~60% duplicated.)
5. **Tokens or it doesn't merge.** The design system lives in build config and is linted.
   (v1: fully documented token spec, zero tokens in code.)
6. **Tests measure the shipped app, by default.** Include-by-default globs, CI gates, no
   parallel deprecated code paths. (v1: 21/62 test files silently excluded, green suite
   testing dead stores.)

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Session backend | **Cloudflare Durable Objects** (PartyKit-style, via `partyserver` or raw DO + `cloudflare:workers`) | One DO instance per session; WebSocket hibernation API for cost; DO storage + alarms |
| Static hosting | Cloudflare Pages (same account/deploy) | SPA assets |
| Client | **Vite + React 19 + TypeScript (strict)** | No SSR need; the DO is the whole backend |
| Styling | **Tailwind CSS v4** (`@theme` tokens) | Tokens are the design system; CI lint forbids raw palette/hex in components |
| Motion | Framer Motion (`motion`) | Springs for swipe physics; global reduced-motion wrapper |
| Local state | Zustand (one store per session, factory-created) + localStorage persistence for in-round sort | Local-first sorting |
| Validation/contracts | **Zod** in `shared/` | Single source of truth for messages, config, decks — parsed at every boundary |
| Drag (rank screen only) | `@dnd-kit/core` | Keyboard sensor configured (v1 omitted it) |
| Export | **satori + resvg** in a Worker route (PNG), `pdf-lib` wrapper (PDF) | Data → JSX → SVG → PNG; no html2canvas |
| Palette extraction | Client-side (canvas sampling / `node-vibrant`-class lib) + contrast math in `shared/` | Adaptive theme from uploaded art |
| Tests | Vitest (+ fast-check property tests), Playwright | Two-browser multiplayer E2E |

## 3. Topology

```
Browser SPA (Cloudflare Pages)
   │  wss:// (one socket per participant)
   ▼
Session Durable Object  (id = session code)
   ├─ authoritative state: config, roster, progress, reveals, spotlight
   ├─ DO storage: checkpoint on every mutation
   └─ alarm: 24h expiry → purge
Worker routes (same deploy):
   /api/session          create (returns code)
   /api/export/:plaque   satori render → PNG/PDF
   /join/:code, /wall/:code  → SPA
```

- **No separate REST state.** Session creation is a thin route that spawns/initializes the DO;
  everything else flows over the socket. (v1's REST session store and Ably presence disagreed
  by design.)
- **Auth:** the DO issues a `participantToken` (UUID + HMAC) on join; the client stores it in
  localStorage keyed by session code and presents it on reconnect. Facilitator holds an
  additional creator token issued at create time. No third-party keys in the client at all.

## 4. State model

### 4.1 Shared state (owned by the DO)

```ts
SessionState {
  code: string                     // ABC123
  config: GameConfig               // locked when round 1 starts
  phase: 'lobby' | 'active' | 'concluded'
  participants: Record<Uuid, {
    name: string                   // label only
    avatarHue: number              // derived from UUID
    role: 'facilitator' | 'participant'
    connected: boolean
    progress: { round: number; sorted: number; kept: number; done: boolean }
  }>
  reveals: Record<Uuid, Record<RoundIndex, RevealSnapshot>>  // write-once per key
  spotlight: Uuid | null
  gate: { openRound: number } | null    // facilitator round gating
}

RevealSnapshot {
  cards: { value: string; description: string }[]   // ordered if ranked
  ranked: boolean
  revealedAt: number
}
```

### 4.2 Local state (never sent before reveal)

```ts
SortState {                        // persisted to localStorage per (session, participant)
  round: number
  queue: CardId[]                  // shuffled remaining
  kept: CardId[]
  discarded: CardId[]
  lastAction?: Action              // single-level undo
  ranking?: CardId[]               // final round order
}
```

Milestone reports (`{ round, sorted, kept, done }`) are the only sorting data sent pre-reveal.

### 4.3 Intents (client → DO) and events (DO → clients)

All messages Zod-parsed on both ends. Every intent carries `{ intentId: uuid }`; the DO keeps
a bounded per-participant LRU of processed intent IDs → **idempotent replays**.

```
Intents: join, rejoin, updateConfig (lobby only), startGame, reportProgress,
         reveal(round, snapshot), unreveal(round), nudge(text), setGate(round),
         setSpotlight(uuid|null), conclude
Events:  state (full snapshot on join/reconnect), patch (targeted updates),
         nudge, error(code)
```

- **Reconnect = resync:** on socket open, client sends `rejoin(token)`, DO replies with a full
  `state` snapshot. No event replay, no rewind, no client reconciliation.
- The DO validates every intent against `config` (e.g. reveal snapshot card count must equal
  the round's keep-count; `reveal` for a gated round is rejected) — constraints are enforced
  server-side, not by client politeness.

### 4.4 The game engine (`shared/engine`)

Pure functions, no I/O:

```ts
validateConfig(config): Result       // decreasing keeps, deck size, round count 1..6
nextRound(sortState, config): SortState
canFinishRound(sortState, roundCfg): { ok } | { needTrim: n } | { incomplete }
applyIntent(sessionState, intent): SessionState | Rejection   // the DO reducer
```

`applyIntent` is property-tested with fast-check: random valid+invalid intent sequences must
never violate the PRD invariants (write-once reveals, no over-keep, idempotency, no
unrevealed card data in any emitted event).

## 5. Client architecture

```
app/src/
  routes/            landing, create (game designer), join, sort, wall
  engine-ui/         CardStack, SwipeCard, KeptTray, TrimGrid, RankBoard, ProgressRail
  session/           useSession (socket hook + state machine), intents, tokens
  stores/            createSortStore(sessionCode, participantId)  // factory, localStorage-persisted
  theme/             tokens.css (@theme), ThemeProvider, palette-extraction, plaque styles
  components/        Button, Modal (focus trap), Sheet, Toast, Avatar
```

- **Connection state machine:** `connecting → live → reconnecting → resumed | expired`, with a
  quiet UI pill. Sorting components subscribe only to the local store, so they run identically
  offline.
- **One sort experience, config-driven.** `SortRound` renders any round from
  `config.rounds[i]`; trim and rank are conditional phases of the same flow. No per-step pages.
- **Accessibility baked into primitives:** Modal focus trap + `aria-modal`; swipe actions have
  button and keyboard equivalents wired at the component level; motion wrapper resolves
  `prefers-reduced-motion` once.

## 6. Theming & adaptive palette

- Base theme: tactile-warm tokens (cream `--surface`, ink `--text`, terracotta `--accent`,
  layered shadow scale, spacing/radius/z-index/duration scales) defined in Tailwind v4
  `@theme` — the only place colors exist.
- Designed variants override the accent triplet + card-back art.
- **Adaptive palette:** on art upload → downscale in canvas → extract dominant swatches →
  choose accent candidate → derive hover/subtle/on-accent tones in OKLCH → validate all
  pairings AA (contrast math in `shared/`, unit-tested) → fall back to default accent if no
  candidate passes. The resulting palette is stored in `config.theme` so every client and the
  export renderer resolve identical tokens.
- **CI token lint:** a script fails the build on raw Tailwind palette classes
  (`bg-blue-500`), hex literals, or inline z-index in `app/src/**` outside `theme/`.

## 7. Export pipeline

- `GET /api/export/:session/:participant/:round.(png|pdf)` — Worker fetches the reveal
  snapshot + theme from the DO, renders the plaque JSX via satori → SVG → resvg PNG
  (PDF via pdf-lib embed). Only **revealed** data is reachable by construction.
- The wall plaque component and the satori plaque share one layout definition so the export
  matches the screen.

## 8. Session lifecycle

```
create → lobby (joinable, config editable) → active (config locked)
       → concluded (wall + exports live) → expired (24h alarm → storage purge)
```

- Join allowed in lobby and active phases; late joiners start at the gated/open round.
- Disconnects mark `connected: false` (roster shows it); rejoin restores within the 24h window.
- DO alarm at `createdAt + 24h` deletes all storage. No cross-session data retention.

## 9. Testing strategy

| Layer | Tooling | What it proves |
|---|---|---|
| `shared/` engine + schemas | Vitest + fast-check | Config validation; reducer invariants under random intent sequences |
| DO | Vitest + `@cloudflare/vitest-pool-workers` | Join/rejoin, idempotency, gating, expiry alarm, reveal validation |
| Components | Vitest + Testing Library | Sort loop semantics, keyboard paths, focus traps, reduced motion |
| E2E | Playwright | Full solo journey (mobile + desktop viewports); **two-browser** multiplayer (join → sort → reveal → wall → spotlight); **socket-kill reconnect** with no lost work; keyboard-only completion |
| Visual/theme | CI token lint; contrast unit tests; Lighthouse a11y ≥ 95 | Design system integrity |

CI gates on every PR: `tsc --noEmit` (strict), ESLint, Vitest, Playwright. Vitest/Playwright
use **default-include** discovery — a new test file cannot be silently skipped.

## 10. Repo layout

```
values-cards/
  app/          # Vite React SPA
  party/        # Durable Object session server + Worker routes (export, create)
  shared/       # Zod schemas, game engine, contrast math — no I/O, max coverage
  decks/        # bundled decks as JSON + CSV→JSON script for authoring
  specs/        # 2.0 feature specs (ralph units) + status script
  docs/         # this plan, PRD, ADRs
```

## 11. Ralph-loop build process

- Specs from PRD §8, in dependency order. Each spec file contains: scope, out-of-scope,
  acceptance criteria as a testable checklist, and the gate command
  (`pnpm gate` = typecheck + lint + unit + targeted E2E).
- **Loop protocol per feature:** fresh worktree + branch `feature/<spec-id>` → autonomous
  loop: implement → run gate → self-review against the spec checklist → iterate until green →
  update spec status via script → open PR (spec link, checklist, test evidence) → **human
  review checkpoint** → merge.
- `specs/status.json` + a validation script is the single progress record (v1's prose status
  files contradicted themselves in four places; status here is generated, never hand-edited).
- Phase boundaries (0→1→2→3→4) are integration checkpoints: run the full E2E suite plus a
  manual smoke on real devices before starting the next phase.

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| DO/Workers learning curve stalls early loops | Phase 0 spike: spec 01.1 has a minimal echo-session milestone before real logic |
| Swipe physics feel cheap → undermines "premium" | Dedicated tuning pass inside 01.3 with device testing; motion values as tokens |
| Adaptive palette produces ugly/illegible themes | OKLCH derivation + AA validation + curated fallback; art shows regardless, palette only adapts when safe |
| satori font/layout limits for plaque design | Constrain plaque to satori-safe CSS subset from the start; shared layout definition tested in CI |
| 24h DO storage cost/limits with custom decks + art | Art capped (≤1MB, downscaled client-side); decks ≤100 cards; per-session storage budget asserted in tests |
| Scope creep in game designer | Config surface frozen to PRD F1–F3; everything else is 2.1 |

## 13. Immediate v1 action items (independent of 2.0)

1. **Rotate the Ably API key** — the root key is extractable from the deployed v1 bundle.
2. Remove `.env.local` from the repo and purge from history if the key was real.
3. Optionally archive the v1 repo with a README pointer once 2.0 ships.
