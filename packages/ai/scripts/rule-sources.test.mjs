import assert from "node:assert/strict";
import test from "node:test";

import { resolveRuleSources, resolveSourceLocation } from "../dist/sources.js";

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
