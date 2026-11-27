# Testing

Tests protect business behavior: contracts, authorization and identity,
grade rules and calculations, citations, and the school AI.

## Placement

- Co-locate a test with its owner as `*.test.ts` or `*.test.tsx`, and run the
  suite with `pnpm test`.
- `packages/ai` tests use `node:test` against mocked provider responses and
  never spend OpenRouter credits. Feature tests in `packages/api` run against
  `createFixtureSchoolAi` (ADR-0001) and a migrated in-memory D1
  (`packages/api/src/testing`), so they exercise the real seeds.
- Satisfy the types in tests with narrowing or matchers rather than casts or
  weaker assertions.

## Value

Write or retain a test when it verifies at least one of these:

- a business contract or validation rule;
- an authorization, identity, or data-integrity policy;
- a non-trivial calculation, policy matrix, or state transition;
- an important failure, recovery, or regression path.

Avoid tests that match source text, repeat the type system, assert
configuration constants, or assert trivial wiring.

Run the narrowest useful suite while iterating, then `pnpm check` and
`pnpm test` before opening or updating a pull request.

## Nemu Extension in a real browser

Unit tests can't load the extension, so after changing `apps/extension`, run
`pnpm --filter extension verify` with `NEMU_RESPONDER=fixture pnpm dev` running.
It builds the extension, loads it in Playwright's Chromium, walks the settings
page and the mock AlurSekolah, and saves screenshots to
`apps/extension/.output/verify/`; look at them before reporting the change as
verified. Changes to the executor (`features/executor`) also need
`pnpm --filter extension verify:executor`, which uses a development build for its `?uji-nemu` dock.
Neither is part of `pnpm test` because they need the dev stack running.
See `apps/extension/README.md`.
