# Values Cards 2.0 — Validated Design

**Date:** 2026-08-02
**Status:** Validated with product owner (brainstorming session)
**Companion docs:** [2.0 PRD](2026-08-02-values-cards-2.0-prd.md) · [2.0 Architecture Plan](2026-08-02-values-cards-2.0-architecture.md)

## Why 2.0

v1 (this repo) proved the product idea but died on its architecture and visuals. A three-agent
review of the repo (specs, architecture, UI) established:

- **Distributed state was the failure zone.** Four unreconciled writers (in-memory API sessions,
  Ably presence blob, Ably events, local Zustand) with last-write-wins presence replacement:
  revealing wiped your emoji; advancing a step destroyed your reveal. Five successive partial
  migrations (04.3 → 04.4 → 04.4.2 → 04.5 → 04.5.5) each left the previous layer in place.
- **The Ably root key shipped in the client bundle** (`NEXT_PUBLIC_ABLY_KEY`) and `.env.local`
  was committed. (Action item independent of 2.0: rotate the key.)
- **The design system was documentation-only.** A full token spec existed in
  `.claude/context/style-guide.md`; `tailwind.config.ts` had an empty `theme.extend`. Cards
  specced 5:7 portrait shipped 256×160 landscape. Zero responsive breakpoints on the three
  sorting pages; mobile knowingly abandoned (ADR-004).
- **Tests were green but not measuring the app.** 21 of 62 test files silently excluded by jest
  config whitelists; store tests targeted deprecated global stores production didn't use;
  235 `tsc` errors; the shipped app only ever dealt the joke dev deck.
- **What was right and is kept:** privacy-by-default with opt-in reveals; reveals as immutable
  snapshots (not live streams); join-or-create with one 6-char code; per-participant shuffle;
  the CSV→data deck concept; the constraint-validation and animation utility layers.

## Validated decisions

| Decision | Choice |
|---|---|
| Rewrite scope | **Greenfield, open stack** — fresh repo, keep only exercise rules + card content |
| Usage contexts | **Solo, peer-run, and facilitated all first-class** |
| Devices | **Fully responsive including phones** |
| Core interaction | **Swipe-first everywhere** — one card at a time, swipe/tap/keyboard; no free-form canvas. Spatial arrangement survives only as drag-to-rank in the final round |
| Reveal/discussion | **Shared results wall** — live gallery of revealed results, projector-friendly, spotlight mode |
| Realtime backend | **Cloudflare Durable Object per session** (PartyKit-style) — single authoritative writer, clients send intents |
| Deck management | **Runtime picker + custom CSV upload** — decks are pure data, no build step |
| Game structure | **Facilitator-configurable Game Templates** — rounds, keep-counts, deck, theme all config; classic 40→8→3 is the default template, not the engine |
| Deck art | **Custom art upload → adaptive palette** — extract colors from uploaded card-back art, derive theme tokens within the design system, WCAG-validated with fallback |
| Aesthetic | **Tactile & warm** — cards as premium physical objects; serif display type, warm cream canvas, terracotta accent, layered shadows, spring physics |
| 2.0 scope adds | Facilitator role & controls; session persistence & rejoin (24h); designed export (satori, not html2canvas) |
| Deferred to 2.1 | Commonality insights on the results wall |
| Build process | **Ralph per feature, gated** — PRD decomposed into small feature specs with machine-checkable acceptance criteria; autonomous loop per feature in a worktree; PR review checkpoints |

## Shape of the system

- **One Durable Object per session** owns roster, game config, progress, reveal snapshots.
  Clients send intents; the DO validates against game config and broadcasts state. Idempotent
  mutations; DO storage checkpoints every change; 24h self-expiry via alarm.
- **Local-first sorting**: in-round choices never leave the device until reveal; only progress
  milestones (counts) are shared. Privacy is enforced by architecture — the server never holds
  unrevealed card choices, so it cannot leak them.
- **Identity**: server-issued UUID at join, stored per-session in localStorage for silent rejoin.
  Names are labels, never keys.
- **Client**: Vite + React SPA on Cloudflare Pages. Zustand local state, one typed WebSocket
  hook, Zod schemas shared client/server.
- **Design tokens enforced in CI** — raw palette classes/hex in components fail the build.
- **Testing**: default-include test globs; `tsc`/lint/unit/E2E gates on every merge;
  property-based tests on the DO reducer (invariants: keep-counts, write-once reveals, no
  pre-reveal leaks); two-browser multiplayer E2E; kill-the-socket reconnect E2E.

Full requirements: see the PRD. Full technical detail: see the architecture plan.
