# Nemu PRD Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the travel K1 flows at the user boundary, replace bundled runtime facts with stored data, and add the telco K2 proof on the same safe contracts.

**Architecture:** Deliver three vertical slices. The extension consumes `fill` and `guide`; an API-owned injected data source builds each plain `runNemu` context from repositories; telco-specific process data and deterministic tools plug into that seam without adding database dependencies to `packages/ai`.

**Tech Stack:** TypeScript, React, WXT, Vitest/Vite+, Playwright, oRPC, Drizzle/D1, R2, Zod, OpenRouter adapters.

**Spec:** `docs/superpowers/specs/2026-10-28-prd-completion-design.md`

## Global Constraints

- Follow `AGENTS.md`, `docs/agents/backend-architecture.md`, `docs/agents/frontend-architecture.md`, and `docs/agents/testing.md`.
- Preserve unrelated `packages/infra/alchemy.run.ts` and `apps/web/` changes.
- Do not track or index the supplied evaluator-only answer-key package.
- No automatic fill, submit, approve, delegate, pay, or other confirmation-level mutation.
- No paid data/indexing provider; all provider and repository access stays injected.
- Use TDD for every behavior change and retain RED/GREEN evidence in the execution ledger.
- Git metadata is read-only in this sandbox; record commit steps as blocked rather than altering `.git` permissions.

## Review Focus

- A fill target disappears or is replaced before confirmation: do not mutate another element; show a missing-target warning.
- A controlled React input formats a filled value: dispatch native `input` and `change`, then compare the actual resulting value.
- Guide navigation loops or changes URL without changing step: follow up at most once per page/step signature.
- An active document is deactivated between requests: the next request must exclude every one of its chunks.
- Telco interval boundaries touch but do not overlap, cross midnight, or have an unapproved RCA: merge correctly and suppress an untrusted final amount.

---

### Task 1: Confirmed fill execution and mismatch feedback

**Files:**

- Create: `apps/extension/features/confirmed-fill/lib/confirmed-fill.ts`
- Create: `apps/extension/features/confirmed-fill/lib/confirmed-fill.test.ts`
- Create: `apps/extension/features/confirmed-fill/hooks/use-confirmed-fill.ts`
- Create: `apps/extension/features/confirmed-fill/components/confirmed-fill-control.tsx`
- Create: `apps/extension/features/confirmed-fill/components/confirmed-fill-control.test.tsx`
- Modify: `apps/extension/features/action-level/hooks/use-answer-actions.ts`
- Modify: `apps/extension/features/highlight/lib/highlight-targets.ts`
- Modify: `apps/extension/entrypoints/nemu.content/nemu-overlay.tsx`
- Modify: `apps/extension/e2e/verify.ts`

**Interfaces:**

- Consumes: contract `NemuAction` branch `{type:"fill", level:"konfirmasi", target, label, value}`.
- Produces: `applyConfirmedFill(action, root): FillResult`, `useConfirmedFill(actions)`, and a user-controlled control/mismatch model for the active fill.

- [ ] Write failing pure tests that a fill applies only to its exact current input, invokes the native setter, emits `input` then `change`, and refuses a missing/non-form target.
- [ ] Run the focused pure test and verify RED because confirmed-fill implementation does not exist.
- [ ] Implement the minimal DOM fill helper and rerun to GREEN.
- [ ] Write failing component/hook tests for “Isi Rp447.000”, no mutation before click, value `447000` after click, and “Tidak sesuai hitungan Rp447.000” after a manual change to `745000`.
- [ ] Run the focused component test and verify RED.
- [ ] Implement the hook/control, exclude `fill` from ordinary highlight-step completion, compose it in the overlay beside the active target, and rerun to GREEN.
- [ ] Extend browser verification for K1-02 and K1-03, including the exact filled raw value and mismatch chip.
- [ ] Run extension tests and record GREEN.
- [ ] Attempt the planned commit `feat(extension): execute confirmed fill actions`; if Git remains read-only, record the blocker.

### Task 2: Persistent guide continuation

**Files:**

- Create: `apps/extension/features/guide/lib/guide-session.ts`
- Create: `apps/extension/features/guide/lib/guide-session.test.ts`
- Create: `apps/extension/features/guide/hooks/use-guide-session.ts`
- Modify: `apps/extension/features/chat/hooks/use-nemu-chat.ts`
- Modify: `apps/extension/features/chat/hooks/use-click-follow-up.ts`
- Modify: `apps/extension/features/chat/lib/follow-up.ts`
- Modify: `apps/extension/features/highlight/components/highlight-steps.tsx`
- Modify: `apps/extension/entrypoints/nemu.content/nemu-overlay.tsx`
- Modify: `apps/extension/e2e/verify.ts`

**Interfaces:**

- Consumes: `NemuResponse.guide` plus the current URL and settled Element List.
- Produces: a guide session with `prompt`, `guideId`, ordered steps, `currentStep`, visited page/step signatures, and `continueGuide(elements)`.

- [ ] Write failing reducer tests for starting/replacing/clearing a guide, advancing from server `current_step`, and rejecting duplicate page/step follow-ups.
- [ ] Run the focused test and verify RED.
- [ ] Implement the pure session reducer and rerun to GREEN.
- [ ] Write failing hook tests showing Momen 1 continues after its menu click, uses the new Element List, and never loops on the same URL/step.
- [ ] Run the hook tests and verify RED.
- [ ] Integrate guide-aware follow-up while retaining the one-shot Momen 3 behavior as a special case only until the guide owns it; render canonical guide progress rather than only current response actions.
- [ ] Rerun focused tests to GREEN and extend browser verification for K1-01/K1-04.
- [ ] Run all extension tests and record GREEN.
- [ ] Attempt the planned commit `feat(extension): continue guides across pages`; record a read-only Git blocker if present.

### Task 3: Abort pending chat and narrow permissions

**Files:**

- Modify: `apps/extension/features/chat/api/chat-messaging.ts`
- Modify: `apps/extension/features/chat/api/request-nemu-chat.ts`
- Modify: `apps/extension/features/chat/hooks/use-nemu-chat.ts`
- Modify: corresponding co-located tests
- Modify: `apps/extension/entrypoints/nemu.content/nemu-overlay.tsx`
- Modify: `apps/extension/wxt.config.ts`
- Modify: `apps/extension/README.md`

**Interfaces:**

- Produces: `sendChatRequest(request, signal)` and `cancel()`; aborted requests resolve to no visible result.

- [ ] Write failing hook/transport tests that Esc/reset aborts the current request and a late completion cannot replace state.
- [ ] Run focused tests and verify RED.
- [ ] Thread `AbortSignal` through background messaging/fetch, bind Esc during loading to `cancel`, and rerun to GREEN.
- [ ] Replace `<all_urls>` with explicit app/service origins plus `activeTab`; update the documented capture behavior.
- [ ] Run extension build and manifest inspection, then extension tests.
- [ ] Attempt the planned commit `fix(extension): cancel pending answers and narrow access`.

### Task 4: Finish K1 demo-data consistency and browser acceptance

**Files:**

- Modify: `packages/api/src/modules/process-instances/demo-seed.ts`
- Modify: its co-located tests and generated seed migration only if required
- Modify: `apps/mock-alurkerja` travel fixtures/tests where the corrected route filename is rendered
- Modify: `apps/extension/e2e/verify.ts`

**Interfaces:**

- Produces: a Yogyakarta–Makassar outbound document name and K1 browser verification covering K1-01 through K1-08 observable behavior.

- [ ] Write the failing seed/UI test for a Yogyakarta-origin boarding-pass filename and verify RED.
- [ ] Correct the seed and fixture, regenerate only the owned seed artifact if required, and verify GREEN.
- [ ] Add/adjust browser assertions for shared date, stale-response clearing, exact citations, and submit guardrail.
- [ ] Run extension Playwright verification with the fixture responder; inspect saved screenshots.
- [ ] Run mock app and extension test suites.
- [ ] Attempt the planned commit `fix(demo): align travel acceptance data`.

### Task 5: Store indexed knowledge chunks

**Files:**

- Modify: `packages/db/src/schema/documents.ts`
- Modify: `packages/db/src/schema/index.ts`
- Generate: `packages/db/src/migrations/<generated>/migration.sql`
- Modify: `packages/api/src/modules/documents/repository.ts`
- Create: `packages/api/src/modules/documents/indexing.ts`
- Create: `packages/api/src/modules/documents/indexing.test.ts`
- Modify: `packages/api/src/modules/documents/service.ts`
- Modify: `packages/api/src/modules/documents/service.test.ts`

**Interfaces:**

- Produces: `knowledgeChunk` records and `indexMarkdownDocument(document, text): NewKnowledgeChunkRecord[]`; repository methods replace chunks atomically and list chunks belonging to active ready documents.

- [ ] Write failing indexing tests for stable document-scoped IDs, explicit article/section metadata, inactive exclusion, and empty Markdown rejection.
- [ ] Run focused tests and verify RED.
- [ ] Add the schema/repository interface and minimal Markdown indexer reusing the AI chunking rules through a dependency-free shared helper in `packages/ai` or a small contracts-safe module.
- [ ] Rerun indexing tests to GREEN.
- [ ] Write failing upload tests proving Markdown stores chunks, a failed store/index leaves no ready document, deactivation removes chunks from active reads, and PDF receives an explicit non-indexed failure rather than `ready`.
- [ ] Implement the service transaction boundary supported by the repository abstraction and rerun to GREEN.
- [ ] Generate the migration and run DB/API tests.
- [ ] Attempt the planned commit `feat(knowledge): index active markdown documents`.

### Task 6: Build the authoritative Nemu data source

**Files:**

- Create: `packages/api/src/modules/chat/nemu-data-source.ts`
- Create: `packages/api/src/modules/chat/nemu-data-source.test.ts`
- Modify: `packages/api/src/context.ts`
- Modify: `packages/api/src/modules/chat/router.ts`
- Modify: `packages/api/src/modules/chat/service.ts`
- Modify: `packages/api/src/modules/reference-tables/service.ts`
- Modify: `apps/server/src/context.ts`
- Modify: `apps/server/src/services.ts`

**Interfaces:**

- Produces: `NemuRuntimeDataSource.load(userId, request): Promise<NemuRuntimeSnapshot>` with profile, process context, active chunks, SBM rows, holidays, required documents, and current date.
- Consumes: injected repositories and `NemuEngine.respond(request, snapshot)`; fixture responder remains independent.

- [ ] Write failing data-source tests using repository fakes for current user grade/name, active-only chunks, uploaded SBM rows, holidays, and explicit missing-table errors.
- [ ] Run focused tests and verify RED.
- [ ] Implement row-to-`SbmRow` adapters with source citation IDs resolved against active knowledge; rerun to GREEN.
- [ ] Refactor `NemuService` composition so the server passes database-backed snapshots to `runNemu` and no production AI path imports `DEMO_*`.
- [ ] Add integration tests proving a database table update changes the next calculation and a deactivated document disappears from the next retrieval.
- [ ] Run API/AI/server typechecks and tests plus architecture audits.
- [ ] Attempt the planned commit `feat(ai): load runtime facts from stored workspace data`.

### Task 7: Seed the travel workspace through normal storage

**Files:**

- Create/modify generated DB seed migration for active travel documents/chunks and current reference tables
- Modify: data-generation script only to emit seed inputs, not runtime imports
- Modify: `packages/ai/demo.ts` to retain test fixtures only
- Modify: package documentation

**Interfaces:**

- Produces: a fresh database that passes K1 without bundled runtime constants.

- [ ] Write failing integration coverage that an empty database fails clearly and a seeded database answers K1 using stored rows/chunks.
- [ ] Generate deterministic seed inputs from `data/01_knowledge_rag` and `data/02_tabel`, including inactive PMK 54.
- [ ] Apply the seed migration path in tests and rerun to GREEN.
- [ ] Remove runtime demo imports from server composition while retaining offline fixtures/evaluator.
- [ ] Run K1 offline evaluation against the stored-data adapter.
- [ ] Attempt the planned commit `chore(db): seed the travel workspace`.

### Task 8: Add generic deterministic claim tools

**Files:**

- Create: `packages/ai/src/claim-tools.ts`
- Create: `packages/ai/src/claim-tools.test.ts`
- Modify: `packages/ai/src/index.ts`
- Modify: `packages/ai/src/jev.ts`

**Interfaces:**

- Produces: `mergeIntervals`, `calculateClaimCutoff`, `calculateSlaCompensation`, `approvalRoute`, and missing-RCA guard results using integer/rational inputs.

- [ ] Write failing literal tests for KLM-2610-0007 (`C=720`, `Av=3.6`, `A=17.5`, `B=30000000`, result `579167`), touching/non-overlapping intervals, half-up rounding, cap at B, and missing RCA suppression.
- [ ] Run focused tests and verify RED.
- [ ] Implement the minimal tools without binary-float final rounding and rerun to GREEN.
- [ ] Add tool routing types/validation without putting telco answers in prompts or knowledge fixtures.
- [ ] Run the AI suite.
- [ ] Attempt the planned commit `feat(ai): add deterministic SLA claim tools`.

### Task 9: Add telco knowledge and workspace data

**Files:**

- Add: `data/05_telco/01_knowledge/*.md` from the supplied source package
- Add: `data/05_telco/03_data/*` from the supplied source package
- Keep the evaluator-only answer-key package outside the repository and indexed paths.
- Modify: workspace seed generator/migration
- Modify: reference table definitions or add typed telco operational tables owned by their feature

**Interfaces:**

- Produces: workspace `W-TELKO`, active v1.0 documents, inactive v0.9 SOP, and three claim datasets.

- [ ] Add parser/seed tests that enumerate only the six approved knowledge sources and keep v0.9 inactive; assert test-case files never enter chunks.
- [ ] Verify RED before the data package exists.
- [ ] Materialize the supplied Markdown/CSV/JSON sources with source attribution and deterministic IDs.
- [ ] Seed the workspace and operational data, then rerun to GREEN.
- [ ] Add active-version retrieval tests for the 15th-day rule, 99.50% addendum, two-approver matrix, and template.
- [ ] Attempt the planned commit `feat(telco): seed the SLA claim workspace`.

### Task 10: Implement telco process context and canonical workflow

**Files:**

- Modify: `packages/contracts/src/nemu-ids.ts`
- Extend process-context contract with a backward-compatible workspace/domain payload
- Create: `packages/ai/src/claim-workflows.ts`
- Create: `packages/ai/src/claim-workflows.test.ts`
- Modify: `packages/ai/src/index.ts`
- Create: API telco process module using procedure → service → repository

**Interfaces:**

- Produces: canonical K2 guide/actions for registration, CRM/adendum, ticket review, minutes, missing RCA, late rejection, and approval guardrails.

- [ ] Write failing workflow tests for K2-01 through K2-10 response-observable behavior and exact action levels.
- [ ] Run focused tests and verify RED.
- [ ] Add stable ids and the minimal generic process-context extension required by both workflows.
- [ ] Implement deterministic scenario resolution and output construction; rerun to GREEN.
- [ ] Integrate exact citations and inactive-version rejection into pipeline tests.
- [ ] Run contracts, AI, and API suites.
- [ ] Attempt the planned commit `feat(ai): guide SLA claim workflows`.

### Task 11: Build the telco Demo App flows

**Files:**

- Add route modules under `apps/mock-alurkerja/src/routes/_auth/` for claim tasks, CRM, Billing, and NOC
- Add responsibility-based slices under `apps/mock-alurkerja/src/features/sla-claims/`
- Modify AlurKerja menu/task composition
- Modify demo dock controls
- Add co-located component/lib tests

**Interfaces:**

- Consumes: telco process API and `NEMU_IDS`; produces the six-stage, three-claim mock journey with stable current-page elements.

- [ ] Write failing route/feature tests for the three branch outcomes and the exact stable ids required by K2.
- [ ] Run focused tests and verify RED.
- [ ] Implement route-owned screens using existing `packages/ui` primitives and AlurKerja chrome; keep demo controls in separate dock buttons.
- [ ] Add decimal calculation display and server-owned state transitions; rerun to GREEN.
- [ ] Add Dimas demo account/profile and shared 2026-10-14 clock through normal seed/config paths.
- [ ] Run mock app tests, typecheck, and build.
- [ ] Attempt the planned commit `feat(demo): add SLA claim workflow`.

### Task 12: K2 evaluator, browser acceptance, and final verification

**Files:**

- Modify: `packages/ai/scripts/evaluate.mjs`
- Add: telco validators and tests beside the evaluator
- Modify: `apps/extension/e2e/verify.ts`
- Update: package READMEs and PRD traceability document

**Interfaces:**

- Produces: offline deterministic K1/K2 report and browser checks for all 19 cases; live measurements remain separately labelled.

- [ ] Write failing validator tests for every K2 expected result without copying answer-key content into indexed knowledge.
- [ ] Run validator tests and verify RED.
- [ ] Implement validators and offline evaluator coverage; rerun to GREEN.
- [ ] Extend browser verification across both seeded users/workspaces, including guide transitions, fill/mismatch, injection, and no forbidden clicks.
- [ ] Run full browser verification and inspect screenshots.
- [ ] Attempt live three-run K1/K2 evaluation; if DNS/provider access is unavailable, record `not_run` without reporting a pass.
- [ ] Run architecture audits, `pnpm check`, `pnpm test`, and configured production build; separate unrelated preserved failures from feature failures.
- [ ] Run whole-branch review and verification-before-completion.
- [ ] Attempt the planned documentation commit `docs: record PRD acceptance coverage`.
