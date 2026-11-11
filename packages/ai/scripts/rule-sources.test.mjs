import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_KNOWLEDGE_CHUNKS } from "../dist/demo.js";
import {
  defaultRuleSourceLocations,
  resolveRuleSources,
  resolveSourceLocation,
  ruleSourceKeysFor,
} from "../dist/sources.js";
import { buildTelcoWorkspaceSeed } from "./workspace-seed-lib.mjs";

const dataRoot = new URL("../../../data/", import.meta.url);

function chunk(id, fields) {
  return { id, docId: "doc", title: "Doc", version: "1", active: true, text: id, ...fields };
}

test("a location prefers the exact article, then a sub-article, on the given page", () => {
  const chunks = [
    chunk("p4-a5-1", { page: 4, article: "5 ayat (1)" }),
    chunk("p5-a5-1", { page: 5, article: "5 ayat (1)" }),
    chunk("p5-a5", { page: 5, article: "5" }),
    chunk("p6-a50", { page: 6, article: "50" }),
  ];

  assert.equal(resolveSourceLocation(chunks, { docId: "doc", article: "5" }), "p5-a5");
  assert.equal(resolveSourceLocation(chunks, { docId: "doc", article: "5", page: 4 }), "p4-a5-1");
  assert.equal(resolveSourceLocation(chunks, { docId: "doc", page: 6 }), "p6-a50");
  assert.equal(resolveSourceLocation(chunks, { docId: "doc", article: "5", page: 6 }), undefined);
});

test("a location never resolves to an inactive document or another document", () => {
  const chunks = [chunk("old", { active: false, article: "1" }), chunk("other", { docId: "x" })];

  assert.equal(resolveSourceLocation(chunks, { docId: "doc", article: "1" }), undefined);
  assert.deepEqual(
    resolveRuleSources(chunks, { "travel.sbm_lodging": { docId: "doc", article: "1" } }),
    {},
  );
});

test("every travel rule source resolves against the seeded travel knowledge", () => {
  const citations = resolveRuleSources(
    DEMO_KNOWLEDGE_CHUNKS,
    defaultRuleSourceLocations("W-TRAVEL"),
  );

  assert.deepEqual(Object.keys(citations).sort(), ruleSourceKeysFor("W-TRAVEL").sort());
});

test("every telco rule source resolves against the seeded telco knowledge", async () => {
  const seed = await buildTelcoWorkspaceSeed(dataRoot);
  const documents = new Map(seed.documents.map((document) => [document.id, document]));
  const chunks = seed.chunks.map((stored) => {
    const document = documents.get(stored.documentId);
    return {
      id: stored.id,
      docId: stored.documentId,
      title: document.title,
      version: document.version,
      article: stored.article ?? stored.section ?? undefined,
      page: stored.page ?? undefined,
      active: document.isActive,
      text: stored.text,
    };
  });

  const citations = resolveRuleSources(chunks, defaultRuleSourceLocations("W-TELKO"));

  assert.deepEqual(Object.keys(citations).sort(), ruleSourceKeysFor("W-TELKO").sort());
});
