# Nemu AI package

`@nemu/ai` holds the school AI and the knowledge helpers it shares with the Nemu Service. It
contains no Hono, oRPC, D1, or Chrome dependency.

- `src/school/`: the school AI (grade photos and Excel, help, grounded answers, BPMN processes,
  procedures, speech). How the fullstack side calls it is in [`docs/school-ai.md`](../../docs/school-ai.md).
- `src/knowledge.ts`: keyword retrieval over knowledge chunks.
- `src/sources.ts`: Rule Sources, the document location each deterministic rule cites (ADR-0007).
- `scripts/knowledge-chunking.mjs`: splits uploaded Markdown into chunks (`@nemu/ai/chunking`).

The Nemu Service reaches the model-backed parts only through the `SchoolAi` seam
(`createSchoolAi`, or `createFixtureSchoolAi` for tests and `NEMU_RESPONDER=fixture`).

## Commands

```sh
# Unit tests with mocked provider responses (offline, zero credits)
pnpm --filter @nemu/ai test

# School AI evaluation (see docs/school-ai.md)
pnpm --filter @nemu/ai eval:school
```

Admin-uploaded Markdown and PDFs are indexed into `knowledge_document`/`knowledge_chunk`; a PDF is
read from its text layer page by page (ADR-0008), and a scanned PDF fails with an explicit
OCR-unsupported message. Deactivating a document removes its chunks from the next request.
