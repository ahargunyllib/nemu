# Nemu PRD Completion Design

**Date:** 2026-10-28
**Branch:** `feat/ai-improvement`
**Source:** the supplied QA/PRD and synthetic K2 source package

## Intent

Finish the QA/PRD at the user boundary. K1 must work end to end in the extension and Demo App, runtime AI facts must come from authoritative stored data rather than bundled demo constants, and K2 must prove that a second workspace can use the same extension and orchestration seams without weakening action safety.

## Goals

- Make confirmed `fill` actions user-controlled, apply their raw value, and show a mismatch after later manual edits.
- Persist and continue `guide` progress across navigation using fresh page elements, without server conversation memory.
- Abort an in-flight question when the user cancels it.
- Remove the broad extension host permission while preserving allowlisted capture and toolbar behavior.
- Load the signed-in profile, active knowledge, reference tables, holidays, and required-document configuration through an injected runtime data source.
- Index uploaded Markdown immediately; reject unsupported searchable PDF-only ingestion clearly instead of marking it indexed. Stored PDFs remain downloadable source attachments.
- Implement the telco workspace, deterministic interval/decimal calculations, version selection, process context, mock screens, and K2 acceptance cases from the supplied source materials.
- Keep action-level enforcement in the extension and keep submit/approve/delegate controls user-owned.

## Non-goals

- A universal BPMN runtime, visual workflow builder, vector database, or paid retrieval provider.
- Server-side conversation-plan persistence.
- Tracking or indexing the supplied evaluator-only answer-key package.
- Inferring formulas or approval policy with the language model.

## Constraints

- Preserve the modular-monolith procedure → service → repository flow.
- `packages/ai` remains free of database and framework dependencies.
- No paid provider is added; database and file adapters are injected behind `NemuService`.
- Existing unrelated `packages/infra/alchemy.run.ts` and `apps/web/` work stays untouched.
- The current sandbox cannot write Git metadata, so execution records task-scoped diffs and tests but cannot commit.

## Approaches considered

### Chosen: product-complete vertical slices

Complete K1 consumption first, then introduce one runtime workspace-data seam, then add K2 through that seam. Each slice has browser-visible acceptance tests. This exposes integration mistakes early and prevents a large generic platform abstraction from being designed around one workflow.

### Rejected: platform-first generic workflow engine

A generic BPMN/tool DSL could eventually serve many workspaces, but neither K1 nor K2 requires arbitrary authoring. Building it first would add migrations and interpretation rules before two concrete workflows establish the stable abstraction.

### Rejected: patch only the extension

This would make K1 look complete while admin uploads, reference-table changes, and K2 still had no effect on answers. It does not satisfy the PRD’s workspace-switching claim.

## Slice 1: K1 user experience

The extension owns a local guide session containing the original prompt, guide id, ordered steps, and current index. It executes only actions for the current page. After an allowed navigation click, or when the URL changes while a guide is active, it waits for stable elements and re-asks the same prompt once per distinct page/step state. The server remains stateless and recalculates `current_step` from current context.

A confirmed fill renders next to the active target. Clicking it sets the native form value through the element’s own setter and dispatches `input` and `change`, so controlled React fields update normally. The expected value stays attached to that field for the active answer; a later different value renders “Tidak sesuai hitungan <amount>”. Fill never runs automatically.

Chat transport accepts an `AbortSignal`. Esc/reset aborts fetch and invalidates the request so no late response is rendered. Capture uses `activeTab` plus the explicit app/service origins; content scripts remain limited to configured app origins.

## Slice 2: authoritative runtime data

Add an API-owned `NemuDataSource` adapter. For each chat request it loads:

- authenticated user name and `golongan` from the user table;
- process context from the existing process repository;
- current SBM and holiday reference-table rows;
- active, ready indexed knowledge chunks;
- workspace configuration such as required documents and demo clock.

`apps/server` composes this adapter with OpenRouter and calls `runNemu` using the returned snapshot. Tests inject fakes. The AI package continues receiving plain arrays and values.

Knowledge chunks are stored separately from document metadata with document ownership and active status resolved at read time. Markdown upload validates, chunks, and stores atomically. PDF upload remains valid as an attachment but has status `failed` for retrieval with the explicit reason that searchable PDF extraction is not configured; it is never silently treated as indexed. Deactivation immediately removes its chunks from runtime reads without deleting them.

Reference-table adapters map stored row shapes into `SbmRow` and holiday values. Missing required tables fail clearly rather than falling back silently to bundled demo data. Seed migrations keep the existing demo usable.

## Slice 3: K2 telco proof

K2 adds a workspace/domain discriminator and telco process data, but reuses the same request, response, `fill`, `guide`, citation, and action-level contracts. Deterministic tools own:

- claim cutoff and five-working-day deadline;
- merging overlapping `[start, end)` WIB intervals;
- excluding approved customer-power/customer-device RCA intervals;
- blocking final amounts for unapproved RCA;
- the contract formula using integer/rational arithmetic with half-up final rounding;
- approval routing by amount.

The telco workflow supplies canonical guide steps and trusted page targets. Knowledge contains the active v1.0 SOP, contract, approved addendum, approval matrix, application guide, and templates. SOP v0.9 is stored inactive and must never be retrieved. The test-case folder is evaluator-only.

The Demo App gains the required claim screens and stable `data-nemu-id` values while keeping its existing AlurKerja chrome. Demo controls stay in the floating dock. The three seeded claims cover the normal, missing-RCA, and late-claim branches.

## Error and safety behavior

- A missing field or table returns a specific clarification/error and no executable action.
- An aborted request produces no answer card.
- A stale/missing target never receives a DOM mutation.
- Only a visible confirmed fill control can apply a value.
- Manual mismatch feedback never changes the field itself.
- Inactive knowledge and evaluator answer keys cannot become evidence.
- Injection, failed Jev, `dilarang`, submit, approve, delegate, and pay actions cannot be auto-clicked.

## Verification

Each slice follows test-first RED → GREEN cycles. Slice 1 runs extension unit tests and Playwright verification. Slice 2 runs repository/service integration tests plus the K1 pipeline against database snapshots. Slice 3 runs deterministic tool tests, all K2 response validators, and browser flows. Final verification includes formatting, typecheck, full tests, builds, architecture audits, generated-data stability during migration, K1/K2 offline acceptance, and live three-run latency when OpenRouter networking is available.
