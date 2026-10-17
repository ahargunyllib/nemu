# Nemu AI package

`@nemu/ai` implements the model-independent orchestration for the three MVP moments.

## Responsibilities

- Jev through OpenRouter: text-only intent, routing, action level, target selection, and confidence
- GPT-6.1 Sol through OpenRouter: optional screenshot understanding and grounded Indonesian answers
- TypeScript: retrieval, calculations, citation checks, and final action enforcement

The public entry point is:

```ts
runNemu(request, context): Promise<NemuResponse>
```

The package contains no Hono, oRPC, D1, or Chrome dependency. Shared wire schemas and the three
rendering fixtures live in `@nemu/contracts`.

## Commands

```sh
pnpm --filter @nemu/ai test
pnpm --filter @nemu/ai eval:offline
OPENROUTER_API_KEY=... pnpm --filter @nemu/ai eval
```

The normal test suite uses mocked provider responses and never spends API credits. The live Jev
evaluation reads the official files in `data/04_evaluasi`, which must never be indexed as knowledge.

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
