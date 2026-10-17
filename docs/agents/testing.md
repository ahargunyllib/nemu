# Testing

Tests protect business behavior: contracts, Action Level enforcement,
calculations, citations, and the Nemu pipeline.

## Placement

- Co-locate a test with its owner as `*.test.ts` or `*.test.tsx`, and run the
  suite with `pnpm test`.
- `packages/ai` tests use `node:test` against mocked provider responses and
  never spend OpenRouter credits. Extend `packages/ai/src/index.test.ts` for
  pipeline behavior instead of mocking the pipeline's own internals.
- Build requests from `@nemu/contracts/fixtures` so tests and the fixture
  responder (ADR-0001) share one source of example traffic.
- The official evaluation files in `data/04_evaluasi` feed the eval scripts
  only; never index them as knowledge or copy them into fixtures.
- Satisfy the types in tests with narrowing or matchers rather than casts or
  weaker assertions.

## Value

Write or retain a test when it verifies at least one of these:

- a business contract or validation rule;
- an authorization, Action Level, or data-integrity policy;
- a non-trivial calculation, policy matrix, or state transition;
- an important failure, recovery, or regression path.

Avoid tests that match source text, repeat the type system, assert
configuration constants, or assert trivial wiring.

Run the narrowest useful suite while iterating, then `pnpm check` and
`pnpm test` before opening or updating a pull request.
