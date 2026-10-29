# AI Improvement Design

**Date:** 2026-10-28
**Branch:** `feat/ai-improvement`
**Source:** QA Nemu Extension 0.1.81, tested 2026-10-27

## Goal

Make the existing travel-assistance AI reliable enough for the K1 acceptance case without
turning the current travel-specific pipeline into a premature multi-workspace platform. This
branch owns the AI response, its shared wire contract, deterministic calculations, citations,
and AI evaluation. It exposes the data the extension needs for confirmed field filling and
multi-step guidance, but it does not implement the extension UI or navigation lifecycle.

The telco K2 case is a separate follow-up because it requires a real workspace knowledge loader,
a generic process context, and new deterministic tools. Mixing that platform work into the travel
stabilization PR would make the change difficult to review and would conflict with the repository's
small, single-purpose PR rule.

## Scope

### In this branch

- B1 and I2, AI side: identify the calculated value that belongs in the field and emit a safe,
  confirmed fill action containing the target and raw value.
- B3, AI side: calculate dates only from the request's process context and the injected demo clock;
  cover the 12 November 2026 deadline and four remaining working days as a regression.
- B4, AI side: guarantee every response is built from the current request only and that refuse,
  clarify, and error responses have no calculations or actions.
- B5 and I1, AI side: return deterministic, ordered travel guidance metadata so the extension can
  continue a guide after a page change without server-side session memory.
- B7: preserve early out-of-domain rejection, record stage timings, and measure the K1 flows. Make
  only evidence-backed latency changes; do not add caches, queues, or streaming in this branch.
- B8: produce precise legal locations and include deterministic-tool sources, especially PMK
  32/2025, in the response citations.
- B9: replace generic repeated action labels with short labels that name the field or document.
- B14, AI side: refer to controls using the label received in the current Element List instead of
  inventing a translated button name.
- K1 AI evaluation and co-located contract/pipeline tests for these behaviors.

### Explicitly outside this branch

- Extension DOM rescanning and stale element repair (B2).
- Demo App task dates and labels, card placement, screenshots, preview, cancellation, mascot,
  demo data, and manifest permissions (the extension/app sides of B3, B6, B10-B15, I3, and I4).
- Rendering and executing the new fill button, mismatch chip, persisted guide state, progress UI,
  and automatic continuation in the extension. This branch supplies their typed inputs.
- Upload indexing, workspace administration, tenant isolation, or the telco mock application.
- K2 implementation and the combined 19-case final run.

## Design decisions

### 1. Keep `runNemu` stateless

The server will not store a conversation plan or reuse a previous response. Each call derives its
calculations, citations, actions, and guidance from the current validated request plus injected
context. This preserves the current Worker-friendly lifecycle and directly prevents the AI side of
B4.

The extension may later persist the guide identifier and progress across page navigation. On each
new page it sends a fresh request with the fresh Element List and current process context. The AI
then resolves the same canonical workflow against the new page. This avoids a server-side session
store and avoids trusting stale DOM targets.

### 2. Add a typed, confirmed fill action

`NemuAction` will become a discriminated union. Existing click, highlight, and confirm actions keep
their current shape. A fill action adds a string value:

```ts
{
  type: "fill",
  target: "input-nominal-penginapan",
  level: "konfirmasi",
  label: "Isi Rp447.000",
  value: "447000"
}
```

The raw string is suitable for an input element; the localized amount appears only in the label.
The schema rejects a fill action at any level other than `konfirmasi`. `runNemu` emits it only when:

1. the target is present in the current Element List;
2. the value comes from a successful deterministic calculation; and
3. the safety classifier has not failed, detected injection, or returned `dilarang`.

The AI never mutates a page. A later extension change must show a user-controlled button and apply
the value only after that click. This contract solves Zahra's B1/I2 responsibility without taking
over Billy and Natha's extension/UI responsibilities.

### 3. Represent a guide separately from executable actions

Future-page targets must not be placed in `actions`, because actions are executable against the
current Element List. Add optional guidance metadata to an answer:

```ts
{
  id: "travel-request:create",
  steps: [
    { id: "travel-type", target: "...", label: "Pilih jenis perjalanan" },
    { id: "assignment-letter", target: "...", label: "Isi nomor surat tugas" }
  ],
  current_step: 1
}
```

The canonical step list is deterministic code owned by the travel workflow, not model output.
`current_step` is derived from the current URL, process context, and available elements. Only the
currently applicable steps become actions. The response therefore gives the extension stable
progress data while preserving the existing Action Level checks.

The initial travel request, request form, accommodation section, and accountability task use this
same shape. The exact total is taken from each canonical workflow list, so the displayed
"Langkah x dari y" cannot disagree with the returned steps.

### 4. Keep business facts deterministic

The model may phrase an answer, but it does not choose monetary values, deadlines, missing
documents, or workflow order. Those continue to come from tools and canonical workflow data.

For Momen 2, the accommodation result (`447000`) is the fill value, not the SBM rate (`745000`).
For Momen 3, the return date comes from `ProcessContext.return_date`; the current date comes from
the injected `currentDate`; weekends and injected holidays remain excluded by the date tool.

The answer generator receives these trusted facts and explicit wording guidance. Existing Rupiah
validation remains in place. No conversation memory, inferred browser date, or model arithmetic is
introduced.

### 5. Make citations precise and merge tool provenance

The demo-data generator currently creates page-sized legal chunks and assigns the first detected
article to the entire page. A page containing more than one article can therefore cite the wrong
one. It also uses arbitrary section headings as `pasal` values for non-legal documents.

Generation will instead:

- split legal content at explicit `Pasal` boundaries while retaining the page number;
- attach `pasal` only when an explicit legal article is present;
- keep page metadata, but no fake `pasal`, for application guides and other non-legal sections;
- retain inactive documents in generated data but continue excluding them from retrieval.

Deterministic tool results will carry citation IDs in addition to the human-readable `sumber` shown
in calculation details. `runNemu` will merge those IDs with model-selected evidence IDs, validate
all IDs against active knowledge, and deduplicate by document plus location. Thus an SBM lookup
always brings PMK 32/2025 into `citations`, even if the answer model omits it.

### 6. Generate specific labels from trusted workflow data

Travel workflow definitions will supply semantic labels such as:

- `Pilih: tidak menginap`
- `Isi Rp447.000`
- `Unggah laporan perjalanan`
- `Unggah boarding pass pulang`

For page controls such as the final task button, the answer-generation instruction will quote the
actual `PageElement.label` received in the request. Hard-coded prose such as "tekan tombol Kirim"
will not be used when the visible label is `Complete Task`.

### 7. Treat latency as a measured constraint

Retrieval and Jev classification remain concurrent. Unsupported requests must return immediately
after classification and must never invoke the answer generator. K1 evaluation will record total
and stage timings, while unit tests verify the early-exit call graph rather than asserting wall-clock
network speed.

Provider latency is environment-dependent, so the final median-of-three, eight-second requirement
is an acceptance measurement rather than a flaky unit test. If the measured GPT stage remains the
bottleneck, model/provider configuration is a separate operational decision; this design does not
silently change a paid provider.

## Request and response flow

```text
validated current request
        |
        +--> Jev safety/intent classification ----+
        |                                         |
        +--> active knowledge retrieval ----------+--> workflow resolution
                                                       |
                                                       +--> deterministic tools
                                                       |      - values/dates
                                                       |      - source IDs
                                                       |
                                                       +--> answer generation
                                                       |
                                                       +--> output validation
                                                              - trusted amounts
                                                              - active citations
                                                              - Action Levels
                                                              - current targets
                                                              |
                                                              v
                                                  fresh NemuResponse only
```

For an unsupported or failed request, the fixed response path returns empty `calc`, `actions`, and
guidance. A response never merges with an earlier response.

## Component boundaries

- `packages/contracts`: discriminated action schema and optional guide schema; no travel business
  rules.
- `packages/ai/src/tools.ts`: deterministic calculations and provenance-bearing lookup results.
- `packages/ai/src/knowledge.ts` and the demo-data generator: active-only retrieval and precise
  location metadata.
- `packages/ai/src/index.ts`: workflow resolution, guide/action construction, citation merging,
  safety enforcement, and fresh-response assembly.
- `packages/ai/src/openai.ts`: phrasing instructions and strict structured answer generation; no
  action planning or arithmetic.
- `packages/ai/scripts/evaluate.mjs`: K1 AI checks and timing report.
- `apps/server`: composition only. It continues injecting the clock, knowledge, profile, tools, and
  providers through the existing `NemuService` seam.

No database or migration change is needed for this branch.

## Error and safety behavior

- Missing destination, nights, or return date yields one clarification and no actions.
- Missing or inactive evidence yields a refusal and no calculations, actions, or guide.
- Invalid tool inputs yield the existing safe error response with empty derived data.
- Unknown or absent targets never produce executable actions.
- Injection detection, Jev failure, or `dilarang` suppresses click and fill actions.
- Submit/approve/delete/pay controls remain non-autonomous; confirmation labels remain explicit.
- A tool citation that cannot be resolved to active knowledge is a pipeline error, rather than an
  ungrounded source silently reaching the user.

## Verification strategy

Tests are written before implementation and remain co-located with their owners.

### Contract tests

- Accept a `fill` action with `konfirmasi` and a raw string value.
- Reject fill at `jalan_sendiri` or `arahkan`, and reject missing values.
- Accept valid guide metadata and reject inconsistent step indexes.
- Preserve all existing response and action fixtures.

### AI unit and pipeline tests

- Momen 2 emits `Isi Rp447.000` with value `447000`; it never offers `745000` as the fill value.
- Deadline calculation from the shared clock produces 2026-11-12 and four remaining working days.
- A Tokyo refusal after a Makassar answer has empty calculations, actions, citations, and guide.
- Momen 3 opens the visible accountability task at `jalan_sendiri`, then returns specifically
  labelled missing-document steps on the task page.
- Workflow responses contain stable ordered guide steps and a valid current index.
- PMK 113/2012 cites Pasal 34 ayat (1); an SBM-backed answer also cites PMK 32/2025.
- Non-legal guide citations have a page when available but no fabricated `pasal`.
- Inactive knowledge is never retrieved or cited.
- Visible control wording is forwarded to generation guidance.
- Unsupported requests do not call the answer generator.
- Existing injection and Action Level regression tests remain green.

### Evaluation

Extend the existing evaluator with the AI-observable parts of K1-01 through K1-09. UI-only checks
remain in extension browser verification and are not falsely reported as AI passes. The evaluator
must report exact values, citation locations, action levels, guide progress, and stage timings.

Before completion, run the narrow package tests, generated-data consistency check, repository type
checks, full tests, and build checks required by the architecture docs. Browser verification is
required only when the separate extension consumer is implemented.

## Follow-up: workspace and telco K2

After this branch is integrated, a separate design and PR should introduce the smallest reusable
workspace boundary needed by K2:

1. load active uploaded documents and reference tables through an injected workspace source;
2. replace travel-only process context and intent enums with capability-specific adapters;
3. add deterministic SLA interval merging, exclusion, percentage, and half-up monetary rounding;
4. configure W-TELKO with SOP v1.0 active and v0.9 inactive;
5. add K2-01 through K2-10 and run the combined 19-case evaluation.

That follow-up should reuse the fill, guide, citation, safety, and evaluation contracts created here.
It should not introduce full multitenancy, vector infrastructure, or provider changes unless the K2
requirements demonstrate that they are necessary.
