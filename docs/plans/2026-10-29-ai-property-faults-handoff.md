# AI Property Faults Handoff

Date: 2026-10-29

Repository: `ahargunyllib/nemu`. `main` is at `51171a6` (#140, #134, and #135 merged).

## State

- Work branch: `test/ai-properties` (local only, based on `main`, no commits yet).
- Its worktree: `/private/tmp/claude-501/-Users-sfatimahazzahra-Main-Coding-softdev-nemu/61483fda-1910-4222-a565-72da7d0acfd5/scratchpad/prop`. It is a temp folder and may be cleared; if it is gone, run `git worktree prune` and recreate the branch from `origin/main`.
- A subagent was writing failing reproduction tests there (uncommitted, unverified): `fast-check` added to the pnpm catalog and as a dev dependency of `@nemu/ai`; new `packages/ai/src/tools.test.ts` and `demo.test.ts`; additions to `claim-tools.test.ts`, `claim-workflows.test.ts`, and `index.test.ts`; test script updated. No API test yet.
- The main checkout stays on `feat/ai-improvement` with the user's uncommitted `AGENTS.md`, `packages/infra/alchemy.run.ts`, `apps/web/`, and docs/plans files. Never stage or commit them.

## Task (user approved: fix all, clip on both sides, commit, push, open a PR)

Per the user's CLAUDE.md, each fix needs a test that fails first, then passes. Each fault was confirmed by exploration against `main`.

1. **Lodging lumpsum rounding** — `calculateAccommodationLumpSum` (`packages/ai/src/tools.ts`) returns `Math.round(rate * 0.3 * nights)`. The reference `data/04_evaluasi/fungsi_referensi.py` rounds per night with Python `round` (half to even) and multiplies: `per_malam = round(tarif * 30 / 100)`, `total = per_malam * malam`. Counterexample: rate 3,503,324 × 4 nights gives 4,203,989; the reference gives 4,203,988. Real SBM rates (multiples of 1,000) agree. Fix with integer arithmetic and add `per_malam` to the calculation input. `packages/ai/scripts/evaluate.mjs` recomputes `per_malam` itself; read it from the calculation instead.
2. **Demo SBM rows miss golongan I/II hotel rates** — `packages/ai/scripts/generate-demo-data.mjs` emits hotel grades `IV` and `III` only. Mirror production (`packages/api/src/modules/chat/nemu-data-source.ts`), which maps `eselon_IV_golongan_III_II_I` to III, II, and I.
3. **Claim cutoff ignores WIB** — `calculateClaimCutoff` (`packages/ai/src/claim-tools.ts`) uses `receivedAt.slice(0, 10)`. Use the WIB (UTC+7) calendar date of the instant; the contract says periods are in WIB. `2026-10-16T01:30:00+07:00` and `2026-10-15T18:30:00Z` must both be late for period `2026-09`.
4. **Downtime not clipped to the claim month, on both sides.**
   - AI: `ticketFacts` (`packages/ai/src/claim-workflows.ts`) must clip merged counted intervals to `[YYYY-MM-01T00:00+07:00, first of next month 00:00+07:00)`.
   - API: `listTickets` (`packages/api/src/modules/sla-claims/repository.ts`) filters `like(started_at, 'YYYY-MM%')`. It must return tickets that overlap the period. Stored timestamps are ISO text with `+07:00`.
5. **`mergeIntervals` accepts off-minute boundaries** — it checks only `(end - start) % 60000`. Reject start or end times that aren't on whole minutes.
6. **Per-night explanation rejected (can break live Momen 2)** — an answer saying "30% × Rp745.000 = Rp223.500 per malam … = Rp447.000" returns status `error`, because Rp223.500 isn't trusted. Fix 1's `per_malam` input makes it trusted.

## Already verified, no work needed

- Every AI-side item in the QA doc for Extension 0.1.81 (B1, B3, B4, B5, B8, B9, B14, I1, I2, R1, K1-01 through K1-08, K2 offline 10/10) passes on `main`. B7 latency needs a live run.
- 8,000-run `runNemu` fuzzing found no faults: schema, no calculations or guide on non-answers, action gating, prohibited targets, citations, untrusted amounts.
- SLA compensation matches a whole-number oracle; chunking and retrieval behave; "4 remaining working days" is the documented definition.

## Finish

Run `pnpm check-types`, `pnpm test`, `pnpm lint`, and `pnpm --filter @nemu/ai eval:offline`. Commit with conventional messages, with no agent attribution (no `Co-Authored-By`, no "Generated with"). Push `test/ai-properties` and open a small PR with a conventional-commit title.
