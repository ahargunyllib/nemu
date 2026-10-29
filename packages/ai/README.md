# Nemu AI package

`@nemu/ai` implements model-independent orchestration for the travel and telecom SLA-claim workflows.

## Responsibilities

- Jev through OpenRouter: text-only intent, routing, primary target selection, and confidence
- GPT-6.1 Sol through OpenRouter: optional screenshot understanding and grounded Indonesian answers
- TypeScript: retrieval, calculations, citation checks, multi-action planning, and final action enforcement

The public entry point is:

```ts
runNemu(request, context): Promise<NemuResponse>
```

The package contains no Hono, oRPC, D1, or Chrome dependency. Shared wire schemas and the three
rendering fixtures live in `@nemu/contracts`.

## Response boundary

`runNemu` returns decisions for a consumer; it does not operate the page itself:

- A `fill` action carries a raw field value at Action Level `konfirmasi`. The extension must show
  the labelled control and apply the value only after the user clicks it.
- A `guide` is stateless, non-executable workflow metadata. Its one-based `current_step` and ordered
  targets let the extension render progress, but the extension owns cross-page persistence and
  sends the current page's elements again after navigation.
- Citations combine model-selected active retrieval evidence with sources used by deterministic
  calculations. Missing or inactive deterministic provenance fails closed instead of returning an
  ungrounded calculation.
- Submit and approval controls remain user-owned. The extension executes permitted navigation and
  confirmed fills; it never converts a `confirm` action into an automatic click.

## Cross-page follow-up

The Momen 3 follow-up does not add a marker to `NemuRequest`. After the task-link click succeeds,
the extension sends the same `session_id` and prompt once more with the new task-page URL and
Element List. Those current-page fields are sufficient for `runNemu` to return the two missing
upload highlights, the Kirim confirmation, and the deadline calculation. The extension owns the
one-follow-up-per-question limit.

## Commands

```sh
# Unit tests with mocked providers (offline, zero credits)
pnpm --filter @nemu/ai test

# Offline deterministic calculations evaluation (offline, zero credits)
pnpm --filter @nemu/ai eval:offline

# Live, credit-consuming evaluation against real OpenRouter adapters
OPENROUTER_API_KEY=... pnpm --filter @nemu/ai eval:live
```

The unit test suite uses mocked provider responses and never spends API credits. `eval:offline`
validates the six deterministic K1 calculations plus all ten evaluator-only K2 workflow cases and
explicitly marks live-only checks as not run. `eval:live` first probes OpenRouter; unavailable DNS
or networking is recorded as `live_not_run` rather than as a model failure. When reachable it
invokes `runNemu()` against the real OpenRouter Decisions API
(`typesafe/jev-1.13`) and Responses API (`openai/gpt-6.1-sol`), verifying:

- the AI-observable K1-01, K1-02, and K1-04 through K1-08 response requirements
- three consecutive valid responses for each K1 flow
- 20 grounded questions (active docs only, never cites PMK 54/2026)
- 6 deterministic calculation cases
- 5 prompt-injection cases (no automatic actions)
- 5 out-of-domain cases (refuse)
- 5 vision screenshot crops (≥4/5 correct)
- median latency from three runs of each K1-01, K1-02, and K1-04 response, without combining
  initial and follow-up calls (≤8s target per response)
- per-response Jev, retrieval, tools, GPT, and total timings for diagnosis
- K2-01 through K2-10 three times each, with exact deterministic values, active citations,
  guardrails, and an 8-second per-case median target
- Generates `data/04_evaluasi/laporan_evaluasi.json` without exposing keys or base64 screenshots.

K1-03 is extension UI behavior and is not reported as an AI pass. The live evaluation reads the
official test sets in `data/04_evaluasi` and public code-level K2 regression assertions. The
supplied evaluator-only answer-key package is intentionally not tracked or indexed as knowledge.

## Required server configuration

```env
OPENROUTER_API_KEY=
OPENROUTER_GENERATOR_MODEL=openai/gpt-6.1-sol
OPENROUTER_REASONING_EFFORT=low
OPENROUTER_JEV_MODEL=typesafe/jev-1.13
NEMU_DEMO_DATE=2026-11-06
```

The single OpenRouter credential stays in Worker bindings and is never returned to the extension.

## Current integration seam

The live server builds a fresh runtime snapshot from database repositories for every request:
the authenticated user's profile, active ready knowledge chunks, all five reference tables,
holidays, and the Demo App's authoritative Process Instance context. Missing profile fields,
tables, or active regulatory citations fail clearly; the server never falls back to the `DEMO_*`
exports. Those exports remain offline test and evaluation fixtures only.

For a `telco_sla` process context, the server selects only `W-TELKO` chunks and loads the claim,
service, invoice, tickets, task deadline, and approval rules from typed repositories. The browser
context identifies the workspace and claim; it cannot override financial facts. Deterministic
workflow code merges incident intervals, enforces RCA evidence, calculates compensation, selects
the stored approval route, and still leaves fill/submit/approve actions under the normal action
levels.

A fresh database receives the travel documents/chunks and reference tables through migrations.
The knowledge migrations are deterministically generated from the approved travel registry and
`data/05_telco/document_registry.json`. The telco seed creates workspace `W-TELKO`, six active
v1.0 knowledge sources, the inactive v0.9 SOP, and typed claim/service/invoice/ticket/RCA/user/task
rows. `data/05_telco/source_manifest.json` records local classifications for each imported file;
private storage locators and upstream file IDs are intentionally excluded. Evaluation and test-case
folders are never indexed.
Regenerate it after an approved source change with:

```sh
pnpm --filter @nemu/ai seed:generate
```

Admin-uploaded Markdown is indexed into the same `knowledge_document`/`knowledge_chunk` storage.
Deactivating a document removes its chunks from the next request. PDF indexing deliberately fails
with an explicit unsupported message until a provider is selected.
