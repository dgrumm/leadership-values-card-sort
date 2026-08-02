# Values Cards 2.0 — Product Requirements Document

**Date:** 2026-08-02
**Status:** Draft for approval
**Predecessor:** leadership-values-card-sort v1 (PRD v0.4)
**Companions:** [Validated Design](2026-08-02-values-cards-2.0-design.md) · [Architecture Plan](2026-08-02-values-cards-2.0-architecture.md)

---

## 1. Vision

A beautiful, reliable, multiplayer card-sorting exercise engine. People join a session in
seconds on any device, sort a deck of values (or anything else) through progressive
elimination rounds, and reveal their results on a shared wall for discussion. Facilitators
compose the exercise itself — rounds, deck, art, pacing — instead of being handed one
hardcoded flow.

**One-line pitch:** the card-sort exercise, as a premium physical ritual, on every screen.

## 2. Goals & non-goals

### Goals
1. **Delightful on a phone.** The full exercise works beautifully on any device — swipe-first.
2. **Reliable multiplayer.** No state bleeding, no ghost participants, no lost reveals.
   Refresh, drop, and rejoin without losing work.
3. **Configurable exercise.** Game structure (rounds, keep-counts), deck, and visual theme
   are session-creator choices, not code.
4. **Privacy by default.** Card choices never leave the device until the participant reveals.
5. **A keepable artifact.** Every participant leaves with a beautiful export of their result.

### Non-goals (2.0)
- Accounts, auth, or user profiles — sessions are ephemeral (24h), identity is per-session.
- Commonality/overlap analytics on the results wall (**2.1**).
- Async/multi-day exercises, session history, or organizational reporting.
- Free-form spatial canvas sorting (deliberately dropped from v1; drag-to-rank in the final
  round is the only spatial interaction).
- Native mobile apps. Responsive web only.
- Monetization, deck marketplace, template sharing between sessions.

## 3. Users & modes

| Mode | Description | Implications |
|---|---|---|
| **Solo** | One person runs the exercise for themselves | Zero lobby friction; multiplayer UI stays out of the way; export is the payoff |
| **Peer group** | A team joins with a code and self-runs | No special roles; reveal + wall carry the discussion |
| **Facilitated** | A coach/leader configures and paces a workshop (~4–12 people, often on a video call) | Game designer, progress dashboard, nudges, gated rounds, spotlight |

All three are first-class. A facilitator may also participate in the sort.

## 4. The experience

### 4.1 Create a game
- Landing page: **Start a game** / **Join a game**.
- Start: pick the default template (*Leadership Values — 40 → 8 → 3*) for one-tap creation,
  or open the **Game Designer**:
  - **Rounds:** add/remove rounds; each round has a name and a keep-count. Round 1 may be
    "keep any" (open triage) or a number. Keep-counts must be strictly decreasing and ≤ deck
    size. The final round may enable **ranking** (ordered result).
  - **Deck:** choose a bundled deck (Leadership 40, Extended 72, Dev 12) or create a custom
    deck by pasting/uploading CSV (`value,description`). Validated instantly: unique names,
    non-empty descriptions, card count ≥ largest keep-count, ≤ 100 cards.
  - **Theme:** choose a designed card-back/palette variant, or **upload card-back art** —
    the game's color palette adapts to the art (extracted accent + tones, WCAG AA enforced,
    graceful fallback to default).
  - **Facilitation:** toggle facilitator mode (progress dashboard, nudges, round gating,
    spotlight). Off = peer mode.
- Output: a 6-character code (`ABC123`) and share link. People can join while the creator is
  still configuring; the game locks its config when the first round starts.

### 4.2 Join
- Enter code (or follow link) + display name. No account. Duplicate names are allowed
  (identity is a server UUID; names are labels). Each participant gets a deterministic
  avatar color derived from their UUID.
- Rejoining from the same browser silently resumes (participant token in localStorage).

### 4.3 Sort (the core loop)
- One card at a time, front and center: 5:7 portrait card, value name in display serif,
  description beneath.
- **Keep** = swipe right / tap ✓ / → then Enter. **Discard** = swipe left / tap ✗ / ←.
  Spring physics, satisfying commit animation; `prefers-reduced-motion` collapses all motion
  to fades.
- **Undo** the last decision (single-level).
- A **kept tray** (peek bar → expandable sheet) shows kept cards and count vs the round's
  limit; cards can be demoted from the tray at any time.
- **Over-limit trim:** if the round has keep-count N and you finish the deck with > N kept,
  a trim screen shows your kept cards as a grid — tap to cut until N. (You may also keep
  fewer than N and continue.)
- **Between rounds:** kept cards become the next round's deck (reshuffled); discards animate
  to a discard stack whose counter accumulates across rounds.
- **Final round:** after reaching N, a **rank screen** (if ranking enabled): drag to order
  your final cards. Then the result screen.
- Sorting is fully local: it works through connection drops and survives refresh
  (persisted locally per session+round).

### 4.4 Reveal
- Each completed round's result can be revealed — **opt-in, per round, immutable snapshot**.
  A gentle prompt appears at round completion; a first-time explainer clarifies what reveal
  shares. Un-reveal is supported (removes the snapshot from the wall).
- Before reveal, other participants see only your name, avatar, and progress (round + counts).

### 4.5 Results wall
- A live gallery every participant can open (and the natural end-state screen): one
  **plaque** per revealed result — participant name, game title, their cards in the game
  theme. Ranked results show order.
- Projector-friendly: clean full-screen mode, readable at distance, updates live as people
  reveal.
- **Spotlight:** the facilitator (or a participant, for their own plaque) can spotlight one
  plaque — it enlarges on everyone's wall view while that person talks. Facilitator releases
  or moves spotlight.

### 4.6 Facilitator panel
- A drawer visible only to the facilitator:
  - **Progress dashboard:** roster with per-participant round + counts (never card contents),
    connection status.
  - **Nudge:** broadcast a gentle banner ("2 minutes left in Round 1").
  - **Round gating (optional):** rounds unlock for everyone together; otherwise free-run.
  - **Spotlight control** on the wall.
- The facilitator can also sort as a participant; the panel is additive.

### 4.7 Export & after
- From the result screen and the wall: download your plaque as **PNG** (share-ready) or
  **PDF**. Rendered server-side from data in the game's theme — identical to the wall plaque.
- A session results link (the wall, revealed results only) remains live until the session
  expires at **24h**, then all session data is purged.

## 5. Functional requirements (summary)

| # | Requirement |
|---|---|
| F1 | Game templates: configurable rounds (name, keep-count, ranking flag), strictly-decreasing keep validation |
| F2 | Decks as data: bundled JSON decks + custom CSV upload with in-browser validation |
| F3 | Themes: designed variants + adaptive palette from uploaded card-back art (WCAG AA enforced) |
| F4 | Session create/join via 6-char code or link; no accounts; server-issued participant UUIDs |
| F5 | Swipe-first sort loop with tap and full keyboard equivalents; undo; kept tray with demote; over-limit trim; final-round drag-to-rank |
| F6 | Local-first sorting: survives refresh and disconnect; only milestones shared pre-reveal |
| F7 | Opt-in, per-round, immutable reveal snapshots; un-reveal; first-time explainer |
| F8 | Live results wall with plaques and spotlight mode |
| F9 | Facilitator: progress dashboard, nudges, optional round gating, spotlight control |
| F10 | Session persistence: rejoin from same browser; 24h session lifetime; purge on expiry |
| F11 | Export: server-rendered PNG/PDF plaque; session results link |
| F12 | Accessibility: WCAG 2.1 AA; full keyboard operability; focus-trapped modals; `prefers-reduced-motion`; 44px touch targets |
| F13 | Connection UX: reconnecting indicator; sorting uninterrupted offline; state replay on reconnect |

## 6. Product invariants (become automated tests)

1. A participant's unrevealed card choices are never transmitted to or stored on the server.
2. A reveal snapshot is write-once; un-reveal deletes, never edits.
3. Kept-count constraints from the game config are enforced server-side on reveal payloads
   and client-side during sorting.
4. Refresh/reconnect never loses local sorting progress or session membership.
5. Replayed/duplicated client intents produce no state change (idempotency).
6. All theme colors — including adaptive palettes — meet WCAG AA contrast.

## 7. Success criteria

- The classic exercise (40→8→3, 6 participants, reveal, wall, export) runs end-to-end on
  phones and laptops with zero manual recovery.
- A facilitator can design and launch a custom game (custom deck + custom rounds + uploaded
  art) in under 5 minutes without documentation.
- Kill a participant's network mid-sort for 60s: no lost work, silent recovery.
- Lighthouse accessibility ≥ 95 on all screens; keyboard-only completion of the full journey.
- Every merge is gated by typecheck, lint, unit, and E2E — no red merges (v1's failure mode).

## 8. Feature spec decomposition (ralph-ready build order)

Each spec is small, independently verifiable, and lands via an autonomous loop in a worktree
gated on `tsc` + lint + unit + E2E, then PR review. Acceptance criteria live in each spec file
as testable checklists; a status script (not prose) reports progress.

**Phase 0 — Foundation**
| Spec | Contents | Depends on |
|---|---|---|
| 00.1 Repo & CI skeleton | Monorepo-lite (`app/`, `party/`, `shared/`, `decks/`), Vite, Vitest default-include globs, Playwright, CI gates, token-lint check | — |
| 00.2 Shared schemas & game engine | Zod schemas: deck, game config, intents, state; pure round-reduction engine (property-tested) | 00.1 |
| 00.3 Design tokens & primitives | Tailwind v4 `@theme` tokens (tactile-warm), `GameCard`, `Button`, `Modal` (focus trap), motion wrapper w/ reduced-motion | 00.1 |

**Phase 1 — Core experience**
| Spec | Contents | Depends on |
|---|---|---|
| 01.1 Session DO | Durable Object: create/join, roster, identity UUIDs, storage checkpointing, 24h alarm expiry, idempotent intent handling | 00.2 |
| 01.2 Client session layer | Typed WebSocket hook, connection state machine, rejoin via participant token, reconnect replay | 01.1 |
| 01.3 Sort loop | Card stack, swipe/tap/keyboard, undo, kept tray + demote, progress rail, local persistence | 00.2, 00.3 |
| 01.4 Round flow | Round transitions, over-limit trim screen, final-round drag-to-rank, result screen | 01.3 |

**Phase 2 — Multiplayer**
| Spec | Contents | Depends on |
|---|---|---|
| 02.1 Presence & progress | Roster UI, milestone reporting, avatars, connection indicators | 01.2, 01.4 |
| 02.2 Reveal | Snapshot intent, server-side constraint validation, un-reveal, explainer modal | 02.1 |
| 02.3 Results wall | Plaque component, live gallery, full-screen/projector mode, spotlight | 02.2 |

**Phase 3 — Configurability**
| Spec | Contents | Depends on |
|---|---|---|
| 03.1 Game designer | Template picker, round editor with validation, deck picker | 01.1 |
| 03.2 Custom decks | CSV paste/upload, in-browser validation, deck stored in session | 03.1 |
| 03.3 Themes & adaptive palette | Theme variants, art upload, palette extraction, WCAG validation + fallback | 03.1, 00.3 |
| 03.4 Facilitator panel | Dashboard, nudges, round gating, spotlight control | 02.3, 03.1 |

**Phase 4 — Finish**
| Spec | Contents | Depends on |
|---|---|---|
| 04.1 Export | satori plaque rendering (PNG/PDF), download, session results link | 02.3 |
| 04.2 Hardening | Two-browser E2E suite, socket-kill reconnect E2E, load pass (12 participants), a11y audit, perf budget | all |

## 9. Deferred (2.1 candidates)
- Commonality insights ("Integrity appears in 4 of 6 Top 3s") on the wall.
- Saved/shareable game templates and deck library across sessions.
- Facilitator timers with on-screen countdowns.
- Results wall grouping/sorting controls; discussion notes.
