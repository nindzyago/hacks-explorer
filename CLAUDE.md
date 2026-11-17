# Hacks Explorer — Claude Code

@AGENTS.md

Everything above is the law and the workflow; this file adds only Claude Code specifics.

- Parallel work: spawn worker sub-agents with worktree isolation (one task each, from
  `plan/STATUS.md`), merge their branches into `main`, re-run `npm run gate` after each merge.
  `.claude/worktrees/` is gitignored.
- Verification: after a worker finishes, run a separate verifier sub-agent with a fresh context
  against the Definition of Done in `docs/workflow.md` before merging.
- Control channel (from M0.3): Playwright plus `window.__app` in dev and test builds.
