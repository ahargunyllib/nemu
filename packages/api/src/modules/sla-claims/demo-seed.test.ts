import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vite-plus/test";

import { SLA_CLAIM_SEED_TASKS } from "./demo-seed";

const MIGRATIONS_DIR = join(import.meta.dirname, "../../../../db/src/migrations");

async function migratedDatabase() {
  const db = new DatabaseSync(":memory:");
  for (const folder of (await readdir(MIGRATIONS_DIR)).toSorted()) {
    db.exec(await readFile(join(MIGRATIONS_DIR, folder, "migration.sql"), "utf8"));
  }
  return db;
}

// The demo panel's reset restores SLA_CLAIM_SEED_TASKS, so they must be what the migrations seed.
// After changing demo-seed.ts, add a migration that brings applied databases in line.
describe("Klaim SLA seed migrations", () => {
  it("seed exactly the Tasks the demo panel's reset restores", async () => {
    const db = await migratedDatabase();
    const rows = db
      .prepare(
        `SELECT id, workspace_id AS workspaceId, claim_id AS claimId, name,
                assignee_id AS assigneeId, created_at AS createdAt,
                review_due_on AS reviewDueOn, status, approved_by AS approvedBy
         FROM telco_task ORDER BY id`,
      )
      .all()
      .map((row) => ({ ...row, approvedBy: JSON.parse(String(row.approvedBy)) }));

    expect(rows).toEqual(SLA_CLAIM_SEED_TASKS);
  });

  it("seeds a sign-in for every approver on the MP-BILL-02 route", async () => {
    const db = await migratedDatabase();
    const approvers = db
      .prepare(
        `SELECT telco_user.name || ' (' || telco_user.role || ')' AS approver
         FROM telco_user
         INNER JOIN user ON user.id = telco_user.id AND user.workspace_id = telco_user.workspace_id
         INNER JOIN account ON account.user_id = user.id AND account.provider_id = 'credential'`,
      )
      .all()
      .map((row) => row.approver);
    const route = db
      .prepare("SELECT approvers FROM telco_approval_rule ORDER BY minimum_amount DESC LIMIT 1")
      .get();

    expect(approvers).toEqual(expect.arrayContaining(JSON.parse(String(route?.approvers))));
  });
});
