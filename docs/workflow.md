# Workflow

How every task is done, by any agent or human. The laws in `AGENTS.md` override this file.

## 1. The task loop

1. **Orient.** Take the next unchecked task in `plan/STATUS.md`, or the top open entry in
   `docs/gaps.md`. Prefer gaps (stability, correctness, measurement) over adding new features.
   If others work in parallel, claim it first (§5). Read the architecture section and the module
   README.
2. **Name the oracle.** Write down how correctness will be checked and at which level
   (A exact / B tolerance / C rubric review / D scenario). See `reference/REFERENCE.md`.
3. **Test first.** Write the acceptance test (or scenario test) and watch it fail.
4. **Implement** in small green steps. Keep the build working at every step.
5. **Verify.** Run `npm run gate`. For anything visible, run the product with the control channel,
   drive the feature, take screenshots, compare with the oracle.
6. **Record.** Update the module README (behaviour decisions, limitations), `docs/decisions.md`
   for choices made without a human, progress docs if a number moved, and append to
   `log/devlog.md`:
   ```
   ## YYYY-MM-DD HH:MM — M2.4 <title> (agent: <name>)
   Landed: …
   Numbers: … (measured how)
   Still open: …
   ```
7. **Commit** `M<n>.<k>: <what>` and tick the task in `plan/STATUS.md`. Release the claim. Next task.
   (In a worktree, steps 6–7 for `plan/` and `log/` go into your final report instead; see §5.)

## 2. Decision rules

Don't block on choices you can make yourself.

- **Behaviour.** Match the reference (oracle level A/B). If there is none, match what users of
  similar products most commonly expect. Record the choice in `docs/decisions.md` (`K<n>`, `By: agent`).
- **Ask a human only about** the list in `AGENTS.md` L3.
- **Big or architectural work** (> ~2 agent-hours, several tasks, or touching layering, data
  model, persistence, the control channel or a public API): first a one-page design
  (`plan/designs/<task-id>.md` + a published page), then wait for the owner's approval. After
  approval, build it to the end without asking; record the approved decisions in
  `docs/decisions.md`. A change to an approved decision needs a new revision and approval.

## 3. Definition of Done

- [ ] acceptance test(s) written first and passing; oracle level stated in the test or commit;
- [ ] hostile/empty/out-of-range input returns an error, not a crash (test exists);
- [ ] undo/redo or rollback covered where the feature changes user data;
- [ ] the action is a registered command with an automation id for every new interactive element;
- [ ] an action reachable from several places (buttons, menus, API, bulk) behaves the same from
      each, and each entry point is covered;
- [ ] driven through the control channel; screenshot reviewed against the oracle (visible features);
- [ ] `npm run gate` passes;
- [ ] README / decisions / progress docs updated where relevant; devlog entry appended;
- [ ] committed with its task id.

## 4. Reporting progress honestly

- Two numbers: **breadth** (exists?) and **readiness** (holds up for real use?). Each says whether
  it is *measured* (a test, a diff, a benchmark you ran) or *estimated*.
- Stubs, approximations and half-wired settings count as partial, never done.
- Known bugs and limitations go to the module README and `docs/gaps.md`, not only what works.
- Never raise a percentage without evidence a reviewer can rerun. Ratchet floors only go up.

## 5. Parallel work

```sh
git worktree add ../hacks-explorer-<task> -b <task-id>
cd ../hacks-explorer-<task>
npm ci                                  # own node_modules per worktree
export PORT=31xx                        # own dev-server port
```

- **Shared state lives in the main checkout only** (`$CRAFT_MAIN`, the path of the primary
  working tree). Inside a worktree never edit `plan/STATUS.md`, `plan/claims.md` or
  `log/devlog.md`: they would conflict on merge (and gitignored files are not in worktrees at
  all). Read them from `$CRAFT_MAIN`.
- Claim before starting: add `- M2.4 — <agent> — <timestamp>` to `$CRAFT_MAIN/plan/claims.md`;
  never take a claimed task.
- Finish with a report (what landed, numbers, rules users will assume, what was not measured on
  real data, still open, gate result). Whoever merges the branch
  (the orchestrator, or you in single-agent mode) appends it to `log/devlog.md`, ticks
  `plan/STATUS.md` and removes the claim, in the main checkout.
- One owner per module at a time. Shared files (registries, menus, routers) get small surgical
  edits; put new code in new files.
- Build manifests are always valid: write to a temp file outside the tree, then move into place.
- If someone else's in-progress change breaks your build, wait and retry; don't fix their files.
- Merging: the orchestrator merges finished branches into `main`, merges `main` into lagging
  branches, and runs the gate after every merge. CI runs the gate on every PR.
- Clean up: remove finished worktrees and their build directories.
