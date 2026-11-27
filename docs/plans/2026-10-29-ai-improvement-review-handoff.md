# AI Improvement Follow-up Handoff

Date: 2026-10-29

Repository: `ahargunyllib/nemu`

Working pull request: [#140 — feat(ai): complete PRD workflows and telco claims](https://github.com/ahargunyllib/nemu/pull/140)

Working branch: `feat/ai-improvement`

This handoff is for continuing PR #140 after reviewing the latest `main` and the pull requests where `miguroi` is a requested reviewer. Do not use the GitHub Issues assignment queue as a substitute for the review queue.

## Desired outcome

1. Review PRs #134 and #135 on behalf of `miguroi`, with evidence from their diffs and tests.
2. Bring PR #140 up to date with the latest accepted `main` changes without losing its AI, telco, authorization, guide, or confirmed-fill behavior.
3. Resolve the GitGuardian finding on PR #140 before merge.
4. Re-run the relevant tests and update PR #140 with small, conventional follow-up commits.

Do not merge, approve, submit review comments, dismiss security findings, or rewrite shared Git history unless the user explicitly authorizes that external action. Preparing code, local review findings, and test evidence is in scope.

## Authoritative remote state

The GitHub remote was read on 2026-10-29.

- Remote `main`: `d6a36e4d1a10fc89c3f91cf532a915ac15aca92b`
  - Latest commit: `fix(extension): keep Nemu's own UI out of the Area Crop and show the whole crop in its chip (#137)`
- Remote `feat/ai-improvement`: `424f1c9a361670d79180c249e48d1965d0253a0a`
- Merge base: `07d480a8558b85f733e3bf3343c3f96a110b9dda`
- PR #140 is one feature commit ahead of its merge base and 40 commits behind remote `main`.
- The local `origin/main` ref was still at the merge base when this handoff was written. Treat it as stale until a successful fetch resolves it to the remote SHA above.

Start with:

```bash
git status --short --branch
git fetch --prune origin
git rev-parse origin/main
git rev-parse origin/feat/ai-improvement
```

Expected remote SHAs are listed above. If fetch still reports that `refs/remotes/origin/feat/ai-improvement` points to a bad object, repair only that disposable remote-tracking ref, then fetch again:

```bash
git update-ref -d refs/remotes/origin/feat/ai-improvement
git fetch --prune origin
```

Do not delete or reset the local feature branch. Do not use `git reset --hard`.

## Working-tree guardrails

At handoff time, the checkout also contained user-owned changes unrelated to PR #140:

- modified: `packages/infra/alchemy.run.ts`
- untracked: `apps/web/`

Do not stage, discard, rewrite, or include those paths in a commit. Before every commit, inspect both:

```bash
git status --short
git diff --cached --name-only
```

The handoff document and the small GitHub-queue clarification in `AGENTS.md` are intentional documentation changes. Keep implementation commits scoped; do not sweep unrelated files into them.

## Review queue for `miguroi`

GitHub currently reports two pull requests with `review-requested:miguroi`. Neither has a submitted review, inline review comment, or conversation comment yet.

### PR #134 — contract: no calculations on non-answer responses

Link: [PR #134](https://github.com/ahargunyllib/nemu/pull/134)

State at handoff:

- open, mergeable, one commit
- head: `17de760ddf62b9341449d18c892601076edb89d4`
- base: `main`
- requested reviewer: `miguroi`
- CodeRabbit status: success, review skipped

What it changes:

- `nemuResponseSchema` rejects non-empty `calc` when status is `refuse`, `clarify`, or `error`.
- `runNemu` returns calculations only when the generated status is `answer`.
- Contract and AI regression tests cover the refusal path.

Review assessment to verify:

- The contract invariant is correct and should be preserved when PR #140 incorporates the change.
- The change prevents stale calculations from leaking into non-answer responses.
- It deliberately does not stop an unrelated question that the model answers from inheriting a page-selected accommodation scenario. That remaining behavior is in workflow scenario selection, not the response contract.
- PR #140 currently has the same gap: its contract only rejects actions for some non-answer statuses, and its AI response assembly still emits `toolResults.calculations` without the status gate.

Review locally with:

```bash
git fetch origin pull/134/head:refs/remotes/review/pr-134
git diff --stat origin/main...review/pr-134
git diff origin/main...review/pr-134 -- packages/contracts packages/ai
```

Minimum verification:

```bash
pnpm --filter @nemu/contracts test
pnpm --filter @nemu/ai test
pnpm --filter @nemu/api test
pnpm check-types
```

### PR #135 — Yogyakarta–Makassar transport and boarding passes

Link: [PR #135](https://github.com/ahargunyllib/nemu/pull/135)

State at handoff:

- open, mergeable, one commit
- head: `dd415175114e1988bbb94136249e44af08cbc21c`
- base: `main`
- requested reviewer: `miguroi`
- CodeRabbit status: success, review skipped

What it changes:

- Limits the demo form's transport modes to `Pesawat` and `Kendaraan dinas`.
- Replaces the Jakarta boarding-pass fixtures with Yogyakarta–Makassar PDFs.
- Adds a forward migration for the seeded outbound boarding-pass filename.
- Reworks the demo-seed test to replay migrations and compare the final database state to `demo-seed.ts`.
- Updates extension acceptance and Demo App tests to use the new filenames.

Review assessment to verify:

- The route correction is consistent across contracts, generated PDFs, database state, documentation, tests, and extension fixtures.
- The existing seed migration remains immutable; the correction is forward-only.
- Existing stored values outside the narrowed form input can still be read because the database column remains text.
- Generated PDFs remain clearly synthetic demo documents.

Important overlap with PR #140:

- PR #140 already adds `packages/db/src/migrations/20261029010000_correct_demo_boarding_pass/migration.sql` and changes the outbound seed expectation to `boarding-pass-pergi-yia-upg.pdf`.
- PR #140 still retains `Kereta api` and `Bus`, plus several old `upg-cgk` return-file references.
- If PR #135 is accepted into `main`, keep its complete cross-layer correction and migration-replay test. Remove PR #140's redundant, not-yet-merged correction migration only after confirming PR #135's migration produces the same final row. Do not edit an applied or merged migration.

Review locally with:

```bash
git fetch origin pull/135/head:refs/remotes/review/pr-135
git diff --stat origin/main...review/pr-135
git diff origin/main...review/pr-135 -- apps/mock-alurkerja apps/extension packages/contracts packages/api packages/db docs/demo-app.md
```

Minimum verification:

```bash
pnpm --filter @nemu/contracts test
pnpm --filter @nemu/api test
pnpm --filter mock-alurkerja test
pnpm --filter @nemu/ai test
pnpm check-types
```

## PR #140 security finding

GitGuardian posted one `Generic Password` finding on PR #140 for `apps/mock-alurkerja/src/features/auth/lib/demo-accounts.ts` in commit `424f1c9a...`.

The committed accounts use synthetic `@nemu.demo` addresses and demo-only credentials; the alert is not evidence that private production credentials or provider keys were committed. Still, treat the alert as a merge blocker until it is investigated and cleared.

Required handling:

1. Confirm the values are used only by the seeded local Demo App and are not reused by any real environment.
2. Check the database seed, login fixtures, documentation, and tests for the same credentials.
3. Prefer a clearly non-secret demo authentication fixture or another scanner-safe design if the demo can retain the same observable login behavior without embedded password-shaped values.
4. If the credentials are intentionally public synthetic fixtures and code changes would only disguise them, document the evidence and ask the repository owner to mark the GitGuardian incident as a false positive.
5. If any value is real or reused, remove it, rotate it outside the repository, and coordinate history cleanup. Do not attempt an unannounced force-push.

Never commit:

- `.env` files, API keys, provider tokens, Drive URLs or IDs, local absolute paths, or real user email addresses
- `data/05_telco/06_test-case/**` or any private evaluator answer key
- agent attribution such as `Co-Authored-By` or `Generated with`

## Synchronizing PR #140 with `main`

PRs #134 and #135 were not in `main` when this handoff was written. Review them first. If they are merged, fetch `main` again so PR #140 consumes their accepted commits instead of duplicating them. If they remain open, report that dependency and avoid copying their commits blindly into the feature branch.

Because PR #140 is already public, prefer a normal merge from `origin/main`; do not rebase or force-push by default:

```bash
git switch feat/ai-improvement
git merge origin/main
```

Resolve conflicts by responsibility:

- `main` wins for redesigned UI structure, shared component styling, deleted components, area-crop behavior, task dates, source formatting, loading cancellation, and other already-accepted fixes.
- PR #140 wins for new K1/K2 workflow behavior, telco data and knowledge, workspace/assignee authorization, confirmed `fill` actions, guide state, and database-backed runtime inputs.
- Combine AI changes: preserve `main`'s trusted-workflow answer enforcement and acceptance utilities while keeping PR #140's extracted travel and telco workflow modules.
- Combine contract changes: keep PR #140's `fill`, `guide`, and workspace/domain additions plus PR #134's no-calculation invariant.
- Keep migrations immutable. If two unmerged migrations perform the same correction, retain the accepted `main` migration and remove only the redundant feature-branch migration after verifying equivalent final state.
- Do not resurrect files deleted by the Demo App redesign, including the old `profile-card.tsx` and `demo-today.tsx` implementations.

High-risk overlap includes:

- `apps/extension/entrypoints/nemu.content/nemu-overlay.tsx`
- Answer Card calculation and action hooks
- highlight and navigation-click components
- `apps/extension/e2e/verify.ts`
- Demo App auth, menu, route, and accountability task files
- `packages/ai/src/index.ts` and its tests
- `packages/api/src/modules/chat/service.ts` and its tests
- `packages/contracts/src/index.ts` and `nemu-ids.ts`
- `docs/demo-app.md` and AI evaluation artifacts

After resolving conflicts, inspect the combined diff rather than relying only on a clean merge:

```bash
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
git status --short
```

## Behavior that PR #140 must retain

- K1 multi-step guidance across SPA navigation, including progress and follow-up behavior.
- User-confirmed calculated fills and post-fill mismatch detection.
- Runtime user, workspace, process, document, reference, and knowledge data loaded through repositories instead of production hardcoding.
- W-TELKO services, invoices, tickets, RCA, claims, tasks, approval rules, knowledge, claim workflows, and UI screens.
- Exact telco compensation calculations and citations.
- Workspace and assignee authorization boundaries; approval must fail closed.
- Markdown chunking, upload limits, PDF-header validation, and safe behavior for unindexed PDFs.
- Public deterministic K1/K2 evaluation without private answer-key material.

## Follow-up implementation priorities

1. Resolve the GitGuardian finding or obtain a documented false-positive disposition.
2. Review and test PR #134. Preserve its invariant in the eventual PR #140 merge.
3. Review and test PR #135. Reconcile its complete route correction with PR #140's partial migration.
4. Merge the latest accepted `main` into `feat/ai-improvement`.
5. Resolve cross-layer conflicts using the ownership rules above.
6. Add or preserve regression tests for all conflict resolutions.
7. Run the full verification matrix and update PR #140's description with current evidence.

Do not broaden this follow-up into unrelated open issues. A newly discovered bug should be fixed here only if it was introduced by PR #140, is required to integrate accepted `main`, or blocks the stated PRD workflows.

## Verification before pushing

Run at least:

```bash
pnpm test
pnpm check-types
pnpm lint
pnpm --filter @nemu/ai eval:offline
WXT_SERVER_URL=https://nemu.example WXT_EXTENSION_VERSION=0.1.81 pnpm --filter extension build
```

Also run focused browser/E2E coverage for:

- Area Crop excluding Nemu's own UI
- guide continuation after SPA navigation
- confirmed fill and mismatch detection
- stale element handling after manual navigation
- K1 accommodation and accountability workflows
- K2 claim review, calculation, task creation, and approval authorization

Do not claim live-provider or browser acceptance passed unless it was actually run in this environment.

Before each push:

```bash
git diff --cached --check
git diff --cached --name-only
git status --short
```

Audit the staged snapshot for secrets and private data. Push normal follow-up commits to the existing `feat/ai-improvement` branch and keep PR #140 as the working PR. Do not add attribution trailers.

## Existing verification baseline

Before the latest `main` integration, PR #140 reported:

- `pnpm test`: 383 passed
- `pnpm check-types`: passed
- extension production build: passed with placeholder public build variables
- offline deterministic evaluation: K1 6/6, K2 10/10
- browser and live-provider suites: not run in the restricted environment

Treat this only as a baseline. Re-run verification after integration; do not carry the numbers forward as if they covered the merged result.

## Read first

- `AGENTS.md`
- `docs/agents/backend-architecture.md`
- `docs/agents/frontend-architecture.md`
- `docs/agents/testing.md`
- `docs/agents/issue-tracker.md`
- `docs/plans/2026-10-28-ai-improvement-design.md`
- `docs/superpowers/plans/2026-10-28-prd-completion.md`
- `docs/prd-traceability.md`
- `docs/adr/0003-product-requirements-complete-at-the-user-boundary.md`
- `packages/contracts/src/index.ts`
- `packages/ai/src/index.ts`
- `packages/ai/src/travel-workflows.ts`
- `packages/ai/src/claim-workflows.ts`
- `apps/extension/e2e/verify.ts`

When reporting back, separate:

- review findings for PR #134
- review findings for PR #135
- security disposition for PR #140
- `main` integration changes
- tests actually run and their results
- any remaining blockers requiring user or repository-owner action
