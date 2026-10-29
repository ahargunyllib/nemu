import assert from "node:assert/strict";
import test from "node:test";

import { buildTravelWorkspaceSeed, renderTravelWorkspaceSeedSql } from "./workspace-seed-lib.mjs";

const dataRoot = new URL("../../../data/", import.meta.url);

test("builds deterministic stored travel documents and chunks from the approved registry", async () => {
  const first = await buildTravelWorkspaceSeed(dataRoot);
  const second = await buildTravelWorkspaceSeed(dataRoot);

  assert.deepEqual(first, second);
  assert.equal(first.documents.length, 6);
  assert.equal(first.documents.find((document) => document.id === "pmk-54-2026")?.isActive, false);
  assert.equal(first.documents.filter((document) => document.isActive).length, 5);
  assert.ok(first.chunks.some((chunk) => chunk.documentId === "pmk-113-2012"));
  assert.ok(first.chunks.some((chunk) => chunk.documentId === "pmk-54-2026"));
  assert.equal(
    first.sourcePaths.some((path) => path.includes("04_evaluasi")),
    false,
  );
  assert.equal(
    first.sourcePaths.some((path) => path.includes("06_test-case")),
    false,
  );
});

test("renders a migration that seeds normal knowledge storage with active state intact", async () => {
  const seed = await buildTravelWorkspaceSeed(dataRoot);
  const sql = renderTravelWorkspaceSeedSql(seed);

  assert.match(sql, /INSERT INTO `knowledge_document`/u);
  assert.match(sql, /INSERT INTO `knowledge_chunk`/u);
  assert.match(sql, /'pmk-54-2026'.+?, 0, 'ready'/su);
  assert.match(sql, /'pmk-32-2025-page-19'/u);
  assert.doesNotMatch(sql, /DEMO_KNOWLEDGE_CHUNKS/u);
});
