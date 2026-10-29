# Travel AI Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the travel AI pass the AI-observable K1 requirements with confirmed field-fill data, deterministic multi-step guidance, precise citations, fresh response state, and measurable latency.

**Architecture:** Keep `runNemu` stateless and extract its travel workflow definitions into a focused module. Extend the shared response contract with confirmed fill actions and non-executable guide metadata, then make deterministic tools attach active knowledge provenance that the pipeline merges with model citations. Preserve the existing provider seams and leave extension execution/persistence and the generic telco workspace architecture to follow-up work.

**Tech Stack:** TypeScript, Zod, Node test runner, pnpm workspaces, OpenRouter adapters, Vite Plus.

**Spec:** `docs/plans/2026-10-28-ai-improvement-design.md`

## Global Constraints

- Work only on `feat/ai-improvement`; preserve the user's unrelated `packages/infra/alchemy.run.ts` and `apps/web/` changes.
- Do not add a dependency, database migration, provider, cache, queue, vector store, or server-side conversation/session state.
- A `fill` action always has `level: "konfirmasi"`; Nemu never mutates the page and never fills or submits without a user click.
- Monetary values, dates, missing documents, workflow order, and tool provenance come from deterministic code, not model output.
- Only active knowledge can be retrieved or cited; unresolved deterministic provenance is a safe pipeline error.
- Keep extension rendering/execution, mismatch chips, guide persistence, DOM rescanning, and progress UI outside this branch.
- Keep workspace/telco K2 implementation outside this branch.
- Generate `packages/ai/src/demo.generated.ts` through `pnpm --filter @nemu/ai data:generate`; never patch it manually.
- Co-locate behavior tests, use `@nemu/contracts/fixtures`, and do not spend OpenRouter credits in unit tests.
- Do not add agent attribution to commits or documentation.

## Review Focus

- A hidden or missing nominal field must not receive a fill action; Task 2 adds this pipeline test.
- A failed Jev check, detected injection, or `dilarang` decision must suppress fill and click actions; Task 2 extends the existing safety matrix.
- A legal article or paragraph that starts before a page marker must retain the correct article on the next page; Task 3 adds a focused chunker test.
- Duplicate model/tool citations and inactive or missing tool citations must never become duplicate or ungrounded sources; Task 4 adds both cases.
- A second request that is refused must not inherit calculations, actions, citations, or guidance from the first request; Task 2 adds a sequential regression test.

---

### Task 1: Extend the response contract for fill actions and guide metadata

**Files:**

- Create: `packages/contracts/src/nemu-response.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/package.json`

**Interfaces:**

- Consumes: existing `nemuIdSchema`, `actionLevelSchema`, and `nemuResponseSchema` in `@nemu/contracts`.
- Produces: exported `nemuGuideStepSchema`, `nemuGuideSchema`, `NemuGuideStep`, and `NemuGuide`; `NemuAction` gains the exact fill branch `{ type: "fill"; target: string; level: "konfirmasi"; label: string; value: string }`; `NemuResponse` gains optional `guide?: NemuGuide`.

- [ ] **Step 1: Write failing contract tests**

  Add tests named:

  - `accepts a confirmed fill action with a raw input value`
  - `rejects fill actions without confirmation level or value`
  - `accepts one-based guide progress within the step list`
  - `rejects guide progress beyond the step list`

  Pin these exact values in the positive assertions:

  ```ts
  const fill = {
    type: "fill",
    target: "input-nominal-penginapan",
    level: "konfirmasi",
    label: "Isi Rp447.000",
    value: "447000",
  };

  const guide = {
    id: "travel-request:accommodation",
    steps: [
      {
        id: "choose-non-hotel",
        target: "opt-penginapan-tidak-hotel",
        label: "Pilih: tidak menginap",
      },
      {
        id: "fill-accommodation-amount",
        target: "input-nominal-penginapan",
        label: "Isi Rp447.000",
      },
    ],
    current_step: 1,
  };
  ```

  Assert that `current_step: 3` is rejected for the two-step guide. Assert that `jalan_sendiri`, `arahkan`, an absent `value`, and an empty `value` are rejected for `type: "fill"`.

- [ ] **Step 2: Register and run the contract test to verify RED**

  Add `dist/nemu-response.test.js` to the package's Node test command.

  Run: `pnpm --filter @nemu/contracts test`

  Expected: FAIL because fill and guide schemas do not exist.

- [ ] **Step 3: Implement the discriminated action union**

  In `packages/contracts/src/index.ts`, keep existing click/highlight/confirm wire shapes compatible and add a strict fill branch with `value: z.string().min(1).max(500)` and literal `level: "konfirmasi"`. Export the inferred action type as before.

- [ ] **Step 4: Implement guide schemas and attach them to the response**

  Define strict guide steps with `id`, `target`, and `label`; define a strict guide with `id`, one to twenty steps, and a one-based `current_step`. Add a refinement requiring `current_step <= steps.length`, export inferred types, and add optional `guide` to `nemuResponseSchema`.

- [ ] **Step 5: Run the contract suite to verify GREEN**

  Run: `pnpm --filter @nemu/contracts test`

  Expected: all contract tests PASS.

- [ ] **Step 6: Commit the shared contract**

  ```bash
  git add packages/contracts/src/index.ts packages/contracts/src/nemu-response.test.ts packages/contracts/package.json
  git commit -m "feat(contracts): add confirmed fill and guide metadata"
  ```

### Task 2: Produce deterministic travel guides, safe fills, and specific labels

**Files:**

- Create: `packages/ai/src/travel-workflows.ts`
- Modify: `packages/ai/src/index.ts`
- Modify: `packages/ai/src/index.test.ts`
- Modify: `packages/contracts/src/fixtures.ts`

**Interfaces:**

- Consumes: `NemuGuide`, `NemuAction`, `NemuRequest`, and `ProcessContext` from Task 1; `JevDecision`; deterministic `Calculation[]` and missing-document results.
- Produces:
  - `TravelWorkflowScenario = "start_travel_request" | "travel_request_form_guidance" | "accommodation_guidance" | "accountability_follow_up" | null`
  - `resolveTravelWorkflowScenario(request: NemuRequest, processContext: ProcessContext | undefined, decision: JevDecision): TravelWorkflowScenario`
  - `travelWorkflowGuidance(scenario: TravelWorkflowScenario, request: NemuRequest): readonly string[]`
  - `TravelWorkflowOutputInput = { scenario: Exclude<TravelWorkflowScenario, null>; request: NemuRequest; calculations: readonly Calculation[]; missingDocuments: readonly string[]; actionsAllowed: boolean }`
  - `buildTravelWorkflowOutput(input: TravelWorkflowOutputInput): { guide: NemuGuide; actions: NemuAction[] } | undefined`

- [ ] **Step 1: Write failing Moment 2 fill and guide tests**

  Replace the generic Moment 2 action expectation with these ordered assertions:

  ```ts
  assert.deepEqual(response.actions, [
    {
      type: "highlight",
      target: "opt-penginapan-tidak-hotel",
      level: "arahkan",
      label: "Pilih: tidak menginap",
    },
    {
      type: "fill",
      target: "input-nominal-penginapan",
      level: "konfirmasi",
      label: "Isi Rp447.000",
      value: "447000",
    },
  ]);
  assert.equal(response.guide?.id, "travel-request:accommodation");
  assert.equal(response.guide?.current_step, 1);
  assert.deepEqual(
    response.guide?.steps.map(({ label }) => label),
    ["Pilih: tidak menginap", "Isi Rp447.000"],
  );
  ```

  Add `Moment 2 never fills a hidden or missing nominal target`, asserting no `fill` action when the nominal element is hidden and when it is absent. Also assert no action ever contains value `745000`.

- [ ] **Step 2: Write failing guide, label, date, and freshness tests**

  Add or update pipeline tests that assert:

  - Moment 1 returns a stable `travel-request:create` guide and only the current safe menu click.
  - Moment 3 initial returns the accountability guide plus the `task-pertanggungjawaban` click.
  - Moment 3 follow-up labels are exactly `Unggah laporan perjalanan`, `Unggah boarding pass pulang`, and `Kamu yang mengirim`.
  - Moment 3 calculations include `2026-11-12` and `sisa_hari_kerja: 4` for return date `2026-11-05` and clock `2026-11-06`.
  - A final control labelled `Complete Task` appears verbatim in `workflowGuidance` passed to the answer generator.
  - Running the Makassar request and then a refused Tokyo request with the same `session_id` leaves the Tokyo response with `calc: []`, `actions: []`, `citations: []`, and `guide === undefined`.

- [ ] **Step 3: Extend the existing safety tests to cover fill**

  For Jev failure, injection probability above threshold, and `actionLevel: "dilarang"`, assert there is neither a `click` nor a `fill`. Keep the existing expectation that deterministic workflow actions are empty where already required.

- [ ] **Step 4: Run the AI suite to verify RED**

  Run: `pnpm --filter @nemu/ai test`

  Expected: FAIL on missing guide metadata, missing fill action, and generic action labels.

- [ ] **Step 5: Extract canonical travel workflow definitions**

  Move scenario resolution, travel step constants, and travel-specific wording from `index.ts` into `travel-workflows.ts`. Canonical plans own stable guide IDs, ordered step IDs/targets, and semantic labels. Derive `current_step` from the current URL, process context, and current Element List; never use stored server state.

- [ ] **Step 6: Build current-page actions from deterministic facts**

  Implement `buildTravelWorkflowOutput` so only targets in the current request become actions. Read the accommodation amount from the `hitung_lumpsum_penginapan` calculation, format its label as `Rp447.000`, and serialize the raw value as `447000`. Preserve the current submit/approve/delete/pay prohibitions and autonomous-click safety gates.

- [ ] **Step 7: Integrate travel output without changing generic fallback behavior**

  In `runNemu`, call the extracted resolver and guidance functions, then use travel output for recognized scenarios and the existing generic action builder for `null`. Include `guide` only on successful travel answers. Fixed clarify/refuse/error responses omit it and keep all derived arrays empty.

- [ ] **Step 8: Update shared fixtures**

  Make Moment 2 carry the confirmed fill action and accommodation guide. Add appropriate guide data and specific labels to Moments 1 and 3. Keep fixtures valid shared wire examples; do not add extension execution behavior.

- [ ] **Step 9: Run focused suites to verify GREEN**

  Run:

  ```bash
  pnpm --filter @nemu/contracts test
  pnpm --filter @nemu/ai test
  ```

  Expected: both suites PASS, including existing action-level and injection regressions.

- [ ] **Step 10: Commit deterministic workflow output**

  ```bash
  git add packages/ai/src/travel-workflows.ts packages/ai/src/index.ts packages/ai/src/index.test.ts packages/contracts/src/fixtures.ts
  git commit -m "feat(ai): add deterministic travel guidance plans"
  ```

### Task 3: Generate precise legal knowledge chunks

**Files:**

- Create: `packages/ai/scripts/demo-data-lib.mjs`
- Create: `packages/ai/scripts/demo-data-lib.test.mjs`
- Modify: `packages/ai/scripts/generate-demo-data.mjs`
- Modify: `packages/ai/package.json`
- Modify: `packages/ai/src/index.test.ts`
- Regenerate: `packages/ai/src/demo.generated.ts`

**Interfaces:**

- Consumes: registry documents with `doc_id`, `judul`, status/version fields, and Markdown with optional `[Halaman N]`, `Pasal N`, and numbered ayat markers.
- Produces: `chunkKnowledgeDocument(document, markdown): KnowledgeChunkLike[]`, where each legal chunk has deterministic ID, page, and exact `article`; non-legal chunks never fabricate `article` from a chapter heading.

- [ ] **Step 1: Write failing pure chunker tests**

  Build a synthetic document where `Pasal 34` appears before `[Halaman 9]`, ayat `(1)` begins after the marker, and `Pasal 35` follows later on page 9. Assert:

  ```js
  assert.equal(deadlineChunk.page, 9);
  assert.equal(deadlineChunk.article, "34 ayat (1)");
  assert.match(deadlineChunk.text, /5 \(lima\) hari kerja/u);
  assert.doesNotMatch(deadlineChunk.text, /Pasal 35/u);
  ```

  Add a page-marked application-guide example with `## 5. Alur di aplikasi` and assert every chunk has `article === undefined`.

- [ ] **Step 2: Register and run chunker tests to verify RED**

  Add `scripts/demo-data-lib.test.mjs` to `@nemu/ai`'s test command.

  Run: `pnpm --filter @nemu/ai test`

  Expected: FAIL because `chunkKnowledgeDocument` does not exist.

- [ ] **Step 3: Extract the pure data-generation helpers**

  Move CSV parsing and knowledge chunking helpers into `demo-data-lib.mjs`. Implement chunking as one source-order scan that tracks page, explicit `Pasal`, and explicit ayat; carry the current legal location across a page marker, split when a new article or ayat begins, and use the location in a stable slug suffix. Do not treat mentions such as `sebagaimana dimaksud dalam Pasal 34` as headings.

- [ ] **Step 4: Use the helper from the generator and regenerate data**

  Import `chunkKnowledgeDocument` and the CSV parser from `demo-data-lib.mjs`, remove their old inline versions, then run:

  ```bash
  pnpm --filter @nemu/ai data:generate
  ```

  Expected: `demo.generated.ts` is regenerated from source data with precise legal metadata.

- [ ] **Step 5: Replace brittle generated citation IDs in pipeline tests**

  Add a local test helper that selects an active chunk by `{ docId, page, article }` and returns its ID. Replace hard-coded IDs affected by the new legal chunk boundaries. Add generated-data assertions for:

  - PMK 113/2012 page 9, `34 ayat (1)`, containing the five-working-day rule;
  - PMK 119/2023 page 6, `8 ayat (5)`, containing the 30-percent rule;
  - application guide chunks having no fabricated legal article.

- [ ] **Step 6: Run generation and AI tests to verify GREEN**

  Run:

  ```bash
  pnpm --filter @nemu/ai data:generate
  cp packages/ai/src/demo.generated.ts /tmp/nemu-demo-generated-task-3.ts
  pnpm --filter @nemu/ai data:generate
  cmp /tmp/nemu-demo-generated-task-3.ts packages/ai/src/demo.generated.ts
  pnpm --filter @nemu/ai test
  ```

  Expected: the second generation produces no diff and all AI tests PASS.

- [ ] **Step 7: Commit precise chunk generation**

  ```bash
  git add packages/ai/scripts/demo-data-lib.mjs packages/ai/scripts/demo-data-lib.test.mjs packages/ai/scripts/generate-demo-data.mjs packages/ai/package.json packages/ai/src/index.test.ts packages/ai/src/demo.generated.ts
  git commit -m "fix(ai): generate precise legal citation chunks"
  ```

### Task 4: Merge deterministic tool provenance into response citations

**Files:**

- Modify: `packages/ai/src/tools.ts`
- Modify: `packages/ai/scripts/generate-demo-data.mjs`
- Modify: `packages/ai/src/demo.generated.ts` through generation
- Modify: `packages/ai/src/index.ts`
- Modify: `packages/ai/src/index.test.ts`

**Interfaces:**

- Consumes: exact active chunk IDs from Task 3 and model citation IDs restricted to retrieved evidence.
- Produces: `SbmRow.sourceCitationId: string`; internal `ToolResults.citationIds: string[]`; citation assembly that merges model evidence IDs with active deterministic-tool IDs and deduplicates by document, article, and page.

- [ ] **Step 1: Write failing provenance tests**

  Add assertions that:

  - Moment 2 citations contain PMK 119/2023 Pasal 8 ayat (5), page 6, and PMK 32/2025 page 19.
  - Moment 3 citations contain PMK 113/2012 Pasal 34 ayat (1), page 9.
  - The same location supplied by both model and tool appears once.
  - A tool citation ID that is missing or points to inactive knowledge produces the existing safe error response with empty derived arrays.

- [ ] **Step 2: Run AI tests to verify RED**

  Run: `pnpm --filter @nemu/ai test`

  Expected: FAIL because tool sources are not part of response citations.

- [ ] **Step 3: Attach source citation IDs to generated SBM rows**

  Add required `sourceCitationId` to `SbmRow`. Generate these exact mappings for the current demo tables:

  - hotel → `pmk-32-2025-page-19`
  - daily allowance → `pmk-32-2025-page-15`
  - airport transport → `pmk-32-2025-page-85`
  - ticket → `pmk-32-2025-page-85`

  Run `pnpm --filter @nemu/ai data:generate` and do not edit generated rows by hand.

- [ ] **Step 4: Collect provenance in deterministic tools**

  Initialize `ToolResults` with `citationIds: []`. Add the SBM row's `sourceCitationId` for every lookup used, the active PMK 119/2023 `8 ayat (5)` chunk for the accommodation percentage, and the active PMK 113/2012 `34 ayat (1)` chunk for accountability deadline calculations.

- [ ] **Step 5: Merge and validate citation sources**

  Keep model citation IDs valid only when present in retrieved evidence. Resolve tool citation IDs against all active `context.knowledgeChunks`. Merge the resulting citations in stable order and deduplicate on `docId/article/page`. Throw on unresolved or inactive tool provenance so `runNemu` returns its safe error response.

- [ ] **Step 6: Run generation and AI tests to verify GREEN**

  Run:

  ```bash
  pnpm --filter @nemu/ai data:generate
  cp packages/ai/src/demo.generated.ts /tmp/nemu-demo-generated-task-4.ts
  pnpm --filter @nemu/ai data:generate
  cmp /tmp/nemu-demo-generated-task-4.ts packages/ai/src/demo.generated.ts
  pnpm --filter @nemu/ai test
  ```

  Expected: generated data is stable and all provenance, retrieval, safety, and pipeline tests PASS.

- [ ] **Step 7: Commit tool-grounded citations**

  ```bash
  git add packages/ai/src/tools.ts packages/ai/scripts/generate-demo-data.mjs packages/ai/src/demo.generated.ts packages/ai/src/index.ts packages/ai/src/index.test.ts
  git commit -m "fix(ai): include deterministic tool sources in citations"
  ```

### Task 5: Align K1 validators and latency reporting with the new contract

**Files:**

- Modify: `packages/ai/scripts/moment-validators.mjs`
- Modify: `packages/ai/scripts/moment-validators.test.mjs`
- Modify: `packages/ai/scripts/evaluate.mjs`

**Interfaces:**

- Consumes: fill actions, guide metadata, specific labels, precise citations, and `NemuResponse.timing` from Tasks 2-4.
- Produces: offline-testable validators for the AI-observable K1 requirements and a live report containing per-stage timings plus per-response median latency.

- [ ] **Step 1: Write failing validator tests for K1 behavior**

  Update Moment 2 validation to require the ordered option highlight plus confirmed fill action with `value: "447000"`, and reject `value: "745000"`. Add validator tests for:

  - valid guide ID/current step and invalid progress;
  - specific Moment 3 upload labels;
  - deadline `2026-11-12` plus four remaining working days;
  - a refused response with all derived data empty;
  - exact PMK 113 and PMK 32 citation locations;
  - no automatic click or fill on the submit confirmation.

- [ ] **Step 2: Run the AI suite to verify RED**

  Run: `pnpm --filter @nemu/ai test`

  Expected: validator tests FAIL against the old manual-entry/two-highlight expectations.

- [ ] **Step 3: Implement the K1 validators**

  Keep validators pure and exact. Validate only AI-observable requirements: action type/target/level/value/label, guide progress, calculations, citations, fresh response arrays, and safety. Do not report UI-only K1-03 mismatch chips, extension persistence, DOM rescans, or visual progress as AI passes.

- [ ] **Step 4: Update the live evaluator**

  Run K1-01, K1-02, K1-04, K1-05, K1-06, K1-07, and K1-08 through the validators. For K1-09, run each AI response three times, report the median `total_ms` for each response separately, and keep the target at `<= 8000`. Store `jev_ms`, `retrieval_ms`, `tools_ms`, `gpt_ms`, and `total_ms` for diagnosis. Never sum initial and follow-up calls into one response latency.

- [ ] **Step 5: Run offline tests and evaluation to verify GREEN**

  Run:

  ```bash
  pnpm --filter @nemu/ai test
  pnpm --filter @nemu/ai eval:offline
  ```

  Expected: tests PASS; offline deterministic calculations pass and live-only checks are clearly marked not run.

- [ ] **Step 6: Run live K1 acceptance when credentials are available**

  Run: `pnpm --filter @nemu/ai eval:live`

  Expected: all AI-observable K1 validators pass, no unsafe action is emitted, and each response median is at most 8000 ms. If credentials are unavailable, record B7/live K1 as not run; do not claim it passed and do not change provider configuration.

- [ ] **Step 7: Commit evaluator coverage**

  ```bash
  git add packages/ai/scripts/moment-validators.mjs packages/ai/scripts/moment-validators.test.mjs packages/ai/scripts/evaluate.mjs
  git commit -m "test(ai): cover K1 acceptance behavior"
  ```

### Task 6: Document the delivered boundary and run repository verification

**Files:**

- Modify: `packages/ai/README.md`
- Include: `docs/plans/2026-10-28-ai-improvement-design.md`
- Include: `docs/superpowers/plans/2026-10-28-ai-improvement.md`

**Interfaces:**

- Consumes: the final contract and evaluation behavior from Tasks 1-5.
- Produces: maintainer-facing usage notes and evidence that the branch satisfies repository architecture rules.

- [ ] **Step 1: Document the new response boundary**

  Add a concise README section explaining that `fill` is confirmed data for an extension consumer, `guide` is non-executable stateless workflow metadata, deterministic tool sources are merged into citations, and the extension remains responsible for user-click execution and cross-page persistence. Document `eval:offline` and `eval:live` without copying test answer keys into knowledge fixtures.

- [ ] **Step 2: Run architecture audits**

  Run:

  ```bash
  rg -n '\.(select|insert|update|delete)\(' packages/api/src/modules -g 'router.ts'
  rg -n 'from "(hono|@orpc/|@nemu/db|@nemu/api)' packages/ai/src
  rg -n 'input\.user_id|input\.userId' packages/api/src
  ```

  Expected: no new architecture violations; the first two commands produce no output, and any existing third-command output is reviewed rather than changed outside scope.

- [ ] **Step 3: Run full verification**

  Run:

  ```bash
  pnpm check
  pnpm test
  pnpm build
  ```

  Expected: all commands exit 0.

- [ ] **Step 4: Verify generated data and worktree scope**

  Run:

  ```bash
  pnpm --filter @nemu/ai data:generate
  git diff --exit-code packages/ai/src/demo.generated.ts
  git status --short
  ```

  Expected: generated data has no diff; status contains only this feature's files plus the preserved unrelated `packages/infra/alchemy.run.ts` and `apps/web/` changes.

- [ ] **Step 5: Commit documentation**

  ```bash
  git add packages/ai/README.md docs/plans/2026-10-28-ai-improvement-design.md docs/superpowers/plans/2026-10-28-ai-improvement.md
  git commit -m "docs(ai): document travel AI improvement boundary"
  ```

- [ ] **Step 6: Review the branch before handoff**

  Review `git diff main...HEAD`, confirm every commit is single-purpose and has no attribution trailer, and use `superpowers:requesting-code-review` followed by `superpowers:verification-before-completion` before claiming completion.
