import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test } from "vite-plus/test";

const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function migration(name: string): string {
  const url = new URL(`../../../../db/src/migrations/${name}/migration.sql`, import.meta.url);
  return readFileSync(fileURLToPath(url.href), "utf8");
}

function createTelcoDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  databases.push(database);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(migration("20261017102113_gigantic_skullbuster"));
  database.exec(migration("20261017102150_auth"));
  database.exec(migration("20261028171450_warm_the_renegades"));
  database.exec(migration("20261028171942_broad_mojo"));
  database.exec(migration("20261028174400_curious_white_tiger"));
  database.exec(migration("20261028175159_workspace-demo-context"));
  database.exec(migration("20261028180000_seed_telco_workspace"));
  database.exec(migration("20261029062952_quote_indonesian_demo_labels"));
  return database;
}

describe("seeded telco workspace", () => {
  test("retrieves only active W-TELKO knowledge and never evaluator answers", () => {
    const database = createTelcoDatabase();
    const chunks = database
      .prepare(
        `SELECT document.id AS documentId, document.version, chunk.text
         FROM knowledge_chunk AS chunk
         INNER JOIN knowledge_document AS document ON document.id = chunk.document_id
         WHERE document.workspace_id = ? AND document.is_active = 1 AND document.status = 'ready'
         ORDER BY document.id, chunk.sequence`,
      )
      .all("W-TELKO") as Array<{ documentId: string; version: string; text: string }>;

    expect(new Set(chunks.map((chunk) => chunk.documentId)).size).toBe(6);
    expect(chunks.some((chunk) => chunk.version === "0.9")).toBe(false);
    expect(chunks.some((chunk) => chunk.text.includes("tanggal 15 bulan berikutnya"))).toBe(true);
    expect(chunks.some((chunk) => chunk.text.includes("99,50%"))).toBe(true);
    expect(
      chunks.some((chunk) =>
        chunk.text.includes("Supervisor Billing, lalu Manajer Billing Operations"),
      ),
    ).toBe(true);
    expect(chunks.some((chunk) => chunk.text.includes("TPL-BILL-02"))).toBe(true);
    expect(chunks.some((chunk) => chunk.text.includes("_peringatan"))).toBe(false);
    expect(chunks.some((chunk) => chunk.text.includes("expected_results"))).toBe(false);
  });

  test("quotes the Demo App's Indonesian labels in the application guide", () => {
    const database = createTelcoDatabase();
    const guide = (
      database
        .prepare(
          "SELECT text FROM knowledge_chunk WHERE document_id = 'PA-TN-01' ORDER BY sequence",
        )
        .all() as Array<{ text: string }>
    )
      .map((chunk) => chunk.text)
      .join("\n");

    expect(guide).toContain("Buka Tugas Saya");
    expect(guide).toContain("tekan Selesaikan Tugas");
    expect(guide).toContain('tombol "Kembali ke tugas"');
    expect(guide).toContain("tab Riwayat");
    expect(guide).not.toMatch(/My Tasks|Complete Task|tab History/u);
  });

  test("stores the three claim fixtures and normalized authoritative values", () => {
    const database = createTelcoDatabase();

    expect(database.prepare("SELECT count(*) AS count FROM telco_claim").get()).toEqual({
      count: 3,
    });
    expect(
      database
        .prepare(
          `SELECT effective_sla_basis_points AS effectiveSlaBasisPoints,
                  monthly_fee_idr AS monthlyFeeIdr
           FROM telco_service WHERE id = 'TN-ENT-002'`,
        )
        .get(),
    ).toEqual({ effectiveSlaBasisPoints: 9_950, monthlyFeeIdr: 30_000_000 });
    expect(
      database
        .prepare(
          `SELECT duration_minutes AS durationMinutes
           FROM telco_ticket WHERE id = 'INC-2609-047'`,
        )
        .get(),
    ).toEqual({ durationMinutes: 210 });
    expect(
      database
        .prepare("SELECT ticket_ids AS ticketIds FROM telco_rca WHERE id = 'RCA-2609-07'")
        .get(),
    ).toEqual({ ticketIds: '["INC-2609-014","INC-2609-015"]' });
  });

  test("seeds Dimas and the Telco demo date through workspace configuration", () => {
    const database = createTelcoDatabase();

    expect(
      database.prepare("SELECT demo_date AS demoDate FROM workspace WHERE id = 'W-TELKO'").get(),
    ).toEqual({ demoDate: "2026-10-14" });
    expect(
      database
        .prepare(
          "SELECT id, name, role, workspace_id AS workspaceId FROM user WHERE email = 'dimas@nemu.demo'",
        )
        .get(),
    ).toEqual({
      id: "U-101",
      name: "Dimas Pratama",
      role: "billing_liaison",
      workspaceId: "W-TELKO",
    });
  });
});
