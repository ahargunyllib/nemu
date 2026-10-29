import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { runNemu, type AnswerGenerator, type JevDecider } from "@nemu/ai";
import { momentTwoRequest } from "@nemu/contracts/fixtures";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { z } from "zod";

import { createNemuRuntimeDataSource } from "./nemu-data-source";

const openDatabases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of openDatabases.splice(0)) database.close();
});

function migration(relativePath: string): string {
  const url = new URL(
    `../../../../db/src/migrations/${relativePath}/migration.sql`,
    import.meta.url,
  );
  return readFileSync(fileURLToPath(url.href), "utf8");
}

function createWorkspaceDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  openDatabases.push(database);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(migration("20261017102113_gigantic_skullbuster"));
  database.exec(migration("20261017102150_auth"));
  database.exec(migration("20261017132311_reference-tables"));
  database.exec(migration("20261028171450_warm_the_renegades"));
  database.exec(migration("20261028171942_broad_mojo"));
  database.exec(`
    INSERT INTO user (id, name, email, email_verified, golongan, unit, province, role)
    VALUES (
      'rina',
      'Rina dari database seed',
      'rina-seed@nemu.demo',
      1,
      'III/a',
      'Balai Layanan Digital Wilayah Yogyakarta',
      'DI Yogyakarta',
      'pegawai'
    )
  `);
  return database;
}

const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  golongan: z.string().nullable(),
  unit: z.string().nullable(),
  province: z.string().nullable(),
});

const chunkSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  article: z.string().nullable(),
  section: z.string().nullable(),
  page: z.number().nullable(),
  sequence: z.number(),
  text: z.string(),
  documentTitle: z.string(),
  documentVersion: z.string(),
});

const referenceRowSchema = z.record(z.string(), z.union([z.string(), z.number()]));
const tableSchema = z.object({
  type: z.string(),
  fileName: z.string(),
  columnsJson: z.string(),
  rowsJson: z.string(),
  rowCount: z.number(),
  updatedAt: z.number(),
});

function createSqliteDataSource(database: DatabaseSync) {
  return createNemuRuntimeDataSource({
    profiles: {
      async findById(userId) {
        return profileSchema.parse(
          database
            .prepare("SELECT id, name, golongan, unit, province FROM user WHERE id = ?")
            .get(userId),
        );
      },
    },
    documents: {
      async listActiveReadyChunks() {
        return z.array(chunkSchema).parse(
          database
            .prepare(
              `SELECT
                chunk.id,
                chunk.document_id AS documentId,
                chunk.article,
                chunk.section,
                chunk.page,
                chunk.sequence,
                chunk.text,
                document.title AS documentTitle,
                document.version AS documentVersion
              FROM knowledge_chunk AS chunk
              INNER JOIN knowledge_document AS document ON document.id = chunk.document_id
              WHERE document.is_active = 1 AND document.status = 'ready'
              ORDER BY chunk.document_id, chunk.sequence`,
            )
            .all(),
        );
      },
    },
    tables: {
      async findByType(type) {
        const raw = database
          .prepare(
            `SELECT
              type,
              file_name AS fileName,
              columns AS columnsJson,
              rows AS rowsJson,
              row_count AS rowCount,
              updated_at AS updatedAt
            FROM reference_table
            WHERE type = ?`,
          )
          .get(type);
        if (!raw) return undefined;
        const table = tableSchema.parse(raw);
        return {
          type: table.type,
          fileName: table.fileName,
          columns: z.array(z.string()).parse(JSON.parse(table.columnsJson)),
          rows: z.array(referenceRowSchema).parse(JSON.parse(table.rowsJson)),
          rowCount: table.rowCount,
          updatedAt: new Date(table.updatedAt),
        };
      },
    },
    currentDate: () => "2026-11-06",
  });
}

describe("seeded travel workspace", () => {
  test("fails clearly while storage is empty, then answers K1 from the applied seed migrations", async () => {
    const database = createWorkspaceDatabase();
    const source = createSqliteDataSource(database);

    await expect(source.load("rina", momentTwoRequest)).rejects.toThrow(
      "Missing required reference table",
    );

    database.exec(migration("20261017132523_seed-reference-tables"));
    database.exec(migration("20261028172500_seed_travel_workspace"));
    const snapshot = await source.load("rina", momentTwoRequest);

    expect(snapshot.userProfile.name).toBe("Rina dari database seed");
    expect(snapshot.knowledgeChunks.length).toBeGreaterThan(100);
    expect(snapshot.knowledgeChunks.some((chunk) => chunk.docId === "pmk-54-2026")).toBe(false);
    expect(
      snapshot.sbmRows.find(
        (row) =>
          row.province === "SULAWESI SELATAN" && row.component === "hotel" && row.grade === "III",
      )?.value,
    ).toBe(745_000);

    const accommodationCitation = snapshot.knowledgeChunks.find(
      (chunk) =>
        chunk.docId === "pmk-119-2023" && chunk.page === 6 && chunk.article === "8 ayat (5)",
    );
    expect(accommodationCitation).toBeDefined();
    const jevDecider: JevDecider = async () => ({
      intent: "accommodation_question",
      intentConfidence: 0.99,
      withinDomainProbability: 0.99,
      injectionProbability: 0,
      requiredTool: "lookup_sbm_and_accommodation",
      actionLevel: "konfirmasi",
      actionConfidence: 0.99,
      target: "input-nominal-penginapan",
      targetConfidence: 0.99,
    });
    const answerGenerator: AnswerGenerator = async () => ({
      status: "answer",
      ringkas: "Hak penginapanmu adalah Rp447.000.",
      detail: "Nilainya 30 persen tarif hotel untuk dua malam.",
      citationIds: accommodationCitation ? [accommodationCitation.id] : [],
      warnings: [],
    });
    const response = await runNemu(momentTwoRequest, {
      ...snapshot,
      jevDecider,
      answerGenerator,
    });

    expect(response.status).toBe("answer");
    expect(response.calc.at(-1)?.hasil).toBe(447_000);
    expect(response.citations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ doc_id: "pmk-119-2023", pasal: "8 ayat (5)", halaman: 6 }),
        expect.objectContaining({ doc_id: "pmk-32-2025", halaman: 19 }),
      ]),
    );
  });
});
