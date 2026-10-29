import assert from "node:assert/strict";
import test from "node:test";

import { buildTelcoWorkspaceSeed, renderTelcoWorkspaceSeedSql } from "./workspace-seed-lib.mjs";

const dataRoot = new URL("../../../data/", import.meta.url);

test("indexes exactly the six approved active telco sources and retains v0.9 as inactive", async () => {
  const seed = await buildTelcoWorkspaceSeed(dataRoot);

  assert.equal(seed.workspace.id, "W-TELKO");
  assert.equal(seed.workspace.demoDate, "2026-10-14");
  assert.equal(seed.documents.length, 7);
  assert.equal(seed.documents.filter((document) => document.isActive).length, 6);
  assert.equal(
    seed.documents.find((document) => document.id === "SOP-KLAIM-SLA-01-v0.9")?.isActive,
    false,
  );
  assert.deepEqual(
    seed.documents
      .filter((document) => document.isActive)
      .map((document) => document.id)
      .sort(),
    [
      "ADD-2026-02",
      "KON-2026-01",
      "MP-BILL-02-v1.0",
      "PA-TN-01",
      "SOP-KLAIM-SLA-01-v1.0",
      "TPL-BILL-01-02",
    ],
  );
  assert.equal(
    seed.sourcePaths.some((path) => path.includes("06_test-case")),
    false,
  );
  assert.equal(
    seed.chunks.some((chunk) => chunk.text.includes("expected_results")),
    false,
  );
  assert.ok(
    seed.chunks.some(
      (chunk) => chunk.documentId === "SOP-KLAIM-SLA-01-v1.0" && chunk.article === "2 ayat (1)",
    ),
  );
  assert.ok(
    seed.chunks.some(
      (chunk) =>
        chunk.documentId === "MP-BILL-02-v1.0" && chunk.section === "Bagian 1. Rute persetujuan",
    ),
  );
});

test("seeds authoritative telco operational rows and active-version rules", async () => {
  const seed = await buildTelcoWorkspaceSeed(dataRoot);
  const activeText = seed.chunks
    .filter(
      (chunk) => seed.documents.find((document) => document.id === chunk.documentId)?.isActive,
    )
    .map((chunk) => chunk.text)
    .join("\n");

  assert.equal(seed.claims.length, 3);
  assert.ok(seed.services.length > 0);
  assert.ok(seed.tickets.length > 0);
  assert.ok(seed.invoices.length > 0);
  assert.deepEqual(seed.approvalRules, [
    {
      id: "MP-BILL-02-1",
      workspaceId: "W-TELKO",
      minimumAmount: 0,
      approvers: ["Sari Wulandari (Supervisor Billing)"],
    },
    {
      id: "MP-BILL-02-2",
      workspaceId: "W-TELKO",
      minimumAmount: 500_001,
      approvers: [
        "Sari Wulandari (Supervisor Billing)",
        "Hendra Gunawan (Manajer Billing Operations)",
      ],
    },
  ]);
  assert.match(activeText, /tanggal 15/iu);
  assert.match(activeText, /99[,.]50%/u);
  assert.match(activeText, /Supervisor Billing, lalu Manajer Billing Operations/iu);
  assert.match(activeText, /TPL-BILL-02/u);

  const sql = renderTelcoWorkspaceSeedSql(seed);
  assert.match(sql, /INSERT INTO `workspace`/u);
  assert.match(sql, /'W-TELKO', 'Klaim Kompensasi SLA', 'telco_sla', '2026-10-14'/u);
  assert.match(sql, /'U-101', 'Dimas Pratama', 'dimas@nemu\.demo'/u);
  assert.match(sql, /'dimas-credential', 'U-101', 'credential'/u);
  assert.match(sql, /INSERT INTO `telco_claim`/u);
  assert.match(sql, /INSERT INTO `telco_approval_rule`/u);
  assert.match(sql, /'W-TELKO'/u);
  assert.doesNotMatch(sql, /expected_results|test-cases\.csv/u);
});
