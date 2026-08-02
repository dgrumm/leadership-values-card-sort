# Values Cards 2.0 — Feature Specs

Specs are the units of the ralph build loop. They decompose from
[PRD §8](../docs/plans/2026-08-02-values-cards-2.0-prd.md) in dependency order across five
phases: `00-foundation`, `01-core`, `02-multiplayer`, `03-config`, `04-finish`.

## Spec format

Every spec is a markdown file `specs/<phase>/<id>-<slug>.md` with YAML frontmatter:

```yaml
---
id: "01.3"                    # PRD §8 spec id
title: Sort loop
phase: 01-core
depends_on: ["00.2", "00.3"]  # spec ids that must be merged first
branch: feature/01-3-sort-loop
---
```

and exactly these sections:

- **Scope** — what to build, concrete enough for an autonomous agent (file paths, schema
  names, message names, component names). Where the plan of record is silent on a minor
  detail, the spec states the decision — it never leaves it open.
- **Out of scope** — adjacent work, with the spec id that owns it.
- **Acceptance criteria** — a `- [ ]` checklist. Every item is objectively verifiable;
  wherever possible it names a test file, a gate command, or a behavior an E2E asserts.
  PRD §6 invariants appear as criteria on the spec that owns them.
- **Gate** — the command(s) that must pass before the spec is done.

## Status

`specs/status.json` is the single progress record. It is **generated/validated by
`pnpm spec:status`, never hand-edited**. Statuses: `not-started` → `in-progress` → `done`.
The script fails if status.json disagrees with spec frontmatter (ids, phases, depends_on).

## Ralph loop protocol (per spec)

1. **Pick** the next spec whose `depends_on` are all `done` in `specs/status.json`.
   Never start a spec whose dependencies aren't merged.
2. **Isolate**: create a fresh git worktree on branch `feature/<id-slug>` (the `branch`
   field), off the latest `v2`:
   ```bash
   git worktree add ../vc-01-3 -b feature/01-3-sort-loop v2
   ```
3. **Loop** until green:
   - implement against **Scope**;
   - run the spec's **Gate** (`pnpm gate` = typecheck + lint + token-lint + unit +
     affected E2E, plus any spec-specific test globs);
   - **self-review** the diff against the acceptance checklist — tick only criteria a
     test or command actually proves; fix the implementation, never the test.
4. **Record**: update the spec's checklist in the file, set status via `pnpm spec:status`.
5. **PR to `v2`** titled `feat(<id-slug>): <short description>` containing: spec link,
   the checked acceptance criteria, and test evidence (gate output). Human review is the
   checkpoint; merge only on green CI.
6. Remove the worktree after merge.

Phase boundaries (0→1→2→3→4) are integration checkpoints: run the full E2E suite and a
manual smoke on real devices before starting the next phase.

## Non-negotiables (from CLAUDE.md)

- No secrets in client-reachable code; tokens are issued server-side.
- Never weaken, skip, or whitelist a failing test. Test discovery stays include-by-default.
- All color/spacing/z-index/motion via `@theme` tokens; the token lint is part of the gate.
- Accessibility is a gate: keyboard equivalents, focus traps, `prefers-reduced-motion`.
