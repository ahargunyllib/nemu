# Nemu AI package

`@nemu/ai` implements the model-independent orchestration for the three MVP moments.

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

# Live evaluation against real OpenRouter adapters (Jev 1.13 and GPT-6.1 Sol)
OPENROUTER_API_KEY=... pnpm --filter @nemu/ai eval:live
```

The unit test suite uses mocked provider responses and never spends API credits. `eval:offline` validates the 6 deterministic calculation cases. `eval:live` invokes `runNemu()` against the real OpenRouter Decisions API (`typesafe/jev-1.13`) and Responses API (`openai/gpt-6.1-sol`), verifying:

- 3 consecutive passes for all 3 PRD moments
- 20 grounded questions (active docs only, never cites PMK 54/2026)
- 6 deterministic calculation cases
- 5 prompt-injection cases (no automatic actions)
- 5 out-of-domain cases (refuse)
- 5 vision screenshot crops (≥4/5 correct)
- 10 live runs per moment measuring median latency (≤8s target)
- Generates `data/04_evaluasi/laporan_evaluasi.json` without exposing keys or base64 screenshots.

The live evaluation reads the official test sets in `data/04_evaluasi`, which must never be indexed as knowledge.

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

The server currently bundles a generated snapshot of the team Drive knowledge/table package and
accepts the request's `process_context`. Before the final demo, Billy's mock App endpoint must
replace that context with authoritative `list_my_tasks`/`get_process_instance` data; the workspace
loader can later replace the bundled snapshot. `user_id` is already overwritten with the
authenticated session user.
