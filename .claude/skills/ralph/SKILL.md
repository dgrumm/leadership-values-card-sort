---
name: ralph
description: >
  Launch the next Values Cards 2.0 feature-spec implementation loop (or a named one, e.g.
  "/ralph 01.3"). Use when the user says "ralph", "next spec", "run the next loop", or asks
  to continue the v2 build. Encodes this repo's loop protocol so every session launches
  loops identically.
argument-hint: "[spec-id]"
---

# Ralph — gated per-feature implementation loop

Protocol of record: `specs/README.md`. Process rules: `CLAUDE.md`. Never improvise deviations.

## Launch procedure

1. `git checkout v2 && git pull` — loops branch from up-to-date `v2`.
2. Pick the spec: the argument if given, else the lowest-id spec in `specs/status.json`
   whose status is `not-started` and whose `depends_on` are all `done`. Independent
   eligible specs may launch as parallel loops.
3. Launch ONE background agent per spec via the Agent tool with:
   - `subagent_type: general-purpose`, `model: sonnet`, `isolation: worktree`
   - Escalate model only if a previous loop for this spec failed its gate twice.
4. The agent prompt MUST include, verbatim in substance:
   - Create branch `feature/<id-slug>` (from spec frontmatter `branch:`).
   - Read the spec file (the contract), `CLAUDE.md` (tenets), and the architecture plan
     sections the spec cites. Implement ONLY the spec's Scope.
   - Invoke the `ponytail` skill (full) before writing code; keep it active.
   - Verify `node --version` is ≥ 22 before installing anything
     (if not: `export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"`).
   - Loop: implement → run the spec's Gate (`pnpm gate` + spec-specific commands) → fix →
     repeat until green. Never weaken a check, skip a test, or loosen tsconfig to pass.
   - Check acceptance boxes only when verified by a passing command; leave honest
     unchecked boxes with a reason.
   - Update status via `pnpm spec:status --set <id>=done` (never hand-edit status.json).
   - Commit `feat(<id>): <title>` with gate evidence in the body, ending with the
     Co-Authored-By line. Do NOT push, do NOT open a PR, do NOT deploy or login anywhere.
   - Final report: gate output tail, deviations with reasons, commit hash.

## After the loop reports

1. Independently re-run `pnpm gate` in the agent's worktree (trust but verify).
2. Run a `ponytail-review` pass plus a correctness review on the diff; apply what survives.
3. Push the feature branch; open a PR to `v2` titled `feat(<id>): <title>` with spec link,
   checked criteria, test evidence, and deviations.
4. Human review of the PR is the checkpoint. After merge: `git checkout v2 && git pull`,
   clean up the worktree, then launch the next eligible spec(s).
