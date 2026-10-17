import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import type { ReferenceTableRecord, ReferenceTableRepository } from "./repository";
import {
  listReferenceTables,
  parseReferenceTableCsv,
  readReferenceTable,
  uploadReferenceTable,
} from "./service";
import { REFERENCE_TABLE_TYPES } from "./table-types";

const TABLE_DIR = join(import.meta.dirname, "../../../../../data/02_tabel");
const MIGRATIONS_DIR = join(import.meta.dirname, "../../../../db/src/migrations");

function createFakes() {
  const rows = new Map<string, ReferenceTableRecord>();
  const tables: ReferenceTableRepository = {
    async upsert(record) {
      const saved: ReferenceTableRecord = { updatedAt: new Date(), ...record };
      rows.set(record.type, saved);
      return saved;
    },
    async listSummaries() {
      return [...rows.values()].map(({ columns: _columns, rows: _rows, ...summary }) => summary);
    },
    async findByType(type) {
      return rows.get(type);
    },
  };
  return { tables };
}

async function readTableFile(type: string) {
  const fileName = `${type}.csv`;
  return new File([await readFile(join(TABLE_DIR, fileName))], fileName, { type: "text/csv" });
}

function rejectionOf(fileName: string, text: string) {
  const result = parseReferenceTableCsv(fileName, text);
  return result.ok ? null : result.reason;
}

describe("uploadReferenceTable", () => {
  it.each(REFERENCE_TABLE_TYPES)("recognises %s.csv from data/02_tabel", async (type) => {
    const deps = createFakes();
    const file = await readTableFile(type);

    const result = await uploadReferenceTable(deps, file);

    if (!result.ok) throw new Error(result.reason);
    expect(result.table.type).toBe(type);
    expect(result.table.rowCount).toBeGreaterThan(0);
    expect(result.table.rows).toHaveLength(result.table.rowCount);
    expect(await readReferenceTable(deps, type)).toEqual(result.table);
  });

  it("stores typed values the server can read back", async () => {
    const deps = createFakes();
    await uploadReferenceTable(deps, await readTableFile("sbm2026_uang_harian_dalam_negeri"));
    await uploadReferenceTable(deps, await readTableFile("kalender_libur_2026"));

    const allowance = await readReferenceTable(deps, "sbm2026_uang_harian_dalam_negeri");
    const holidays = await readReferenceTable(deps, "kalender_libur_2026");

    expect(allowance?.rows[0]).toEqual({
      no: 1,
      provinsi: "ACEH",
      luar_kota: 360000,
      dalam_kota_lebih_8_jam: 140000,
      diklat: 110000,
      satuan: "OH",
      sumber: "PMK 32/2025 Lampiran I angka 28.1, hlm. 15",
    });
    expect(holidays?.rows[0]).toMatchObject({ tanggal: "2026-01-01", jenis: "libur_nasional" });
  });

  it("replaces the stored rows when the same table type is uploaded again", async () => {
    const deps = createFakes();
    await uploadReferenceTable(deps, await readTableFile("kalender_libur_2026"));
    const smaller = new File(
      ["tanggal,hari,jenis,keterangan\n2026-01-01,Kamis,libur_nasional,Tahun Baru\n"],
      "libur.csv",
    );

    await uploadReferenceTable(deps, smaller);

    const listed = await listReferenceTables(deps);
    const holidays = listed.find((table) => table.type === "kalender_libur_2026");
    expect(holidays?.stored).toMatchObject({ fileName: "libur.csv", rowCount: 1 });
  });

  it("does not store a rejected CSV", async () => {
    const deps = createFakes();

    const result = await uploadReferenceTable(deps, new File(["a,b\n1,2\n"], "random.csv"));

    expect(result.ok).toBe(false);
    expect((await listReferenceTables(deps)).every((table) => table.stored === null)).toBe(true);
  });
});

describe("parseReferenceTableCsv", () => {
  const holidayHeader = "tanggal,hari,jenis,keterangan";

  it("rejects missing columns and names them", () => {
    expect(
      rejectionOf("sbm2026_transport_terminal_bandara.csv", "no,provinsi,sumber\n1,ACEH,x"),
    ).toBe("Missing columns for SBM 2026 · Transport bandara: besaran_per_orang_per_kali.");
  });

  it("names the closest table's missing columns when the file name is unknown", () => {
    expect(rejectionOf("holidays.csv", "tanggal,hari,keterangan\n2026-01-01,Kamis,x")).toBe(
      "Missing columns for Kalender Libur 2026: jenis.",
    );
  });

  it("rejects a CSV that matches no table", () => {
    expect(rejectionOf("people.csv", "name,email\nRina,rina@nemu.demo")).toMatch(
      /^Unrecognised table/,
    );
  });

  it("rejects a non-numeric amount with its line and column", () => {
    const csv =
      "no,kota_asal,kota_tujuan,bisnis_pp,ekonomi_pp\n1,JAKARTA,AMBON,13285000,tujuh juta\n";

    expect(rejectionOf("tiket.csv", csv)).toBe(
      'Line 2, column "ekonomi_pp": expected a whole number, got "tujuh juta".',
    );
  });

  it("rejects an invalid date", () => {
    expect(rejectionOf("libur.csv", `${holidayHeader}\n2026-02-30,Senin,libur_nasional,x`)).toBe(
      'Line 2, column "tanggal": expected a date as YYYY-MM-DD, got "2026-02-30".',
    );
  });

  it("rejects an unknown holiday kind", () => {
    expect(rejectionOf("libur.csv", `${holidayHeader}\n2026-01-01,Kamis,libur,x`)).toBe(
      'Line 2, column "jenis": expected one of libur_nasional, cuti_bersama, got "libur".',
    );
  });

  it("rejects an empty value", () => {
    expect(rejectionOf("libur.csv", `${holidayHeader}\n2026-01-01,Kamis,cuti_bersama,`)).toBe(
      'Line 2, column "keterangan": expected a value, got an empty value.',
    );
  });

  it("rejects a row with the wrong number of values", () => {
    expect(rejectionOf("libur.csv", `${holidayHeader}\n2026-01-01,Kamis,libur_nasional`)).toBe(
      "Line 2 has 3 values, but the header has 4 columns.",
    );
  });

  it("rejects an empty file and a header without rows", () => {
    expect(rejectionOf("libur.csv", "")).toBe("The file is empty.");
    expect(rejectionOf("libur.csv", `${holidayHeader}\n`)).toBe(
      "The file has a Kalender Libur 2026 header but no rows.",
    );
  });
});

// The seed migration lets the admin see the data/02_tabel tables without uploading.
// Regenerate it after changing the CSVs or the parser: UPDATE_REFERENCE_SEED=1 pnpm test
describe("seed-reference-tables migration", () => {
  it("seeds every table exactly as an upload of data/02_tabel would store it", async () => {
    const statements: string[] = [];
    for (const type of REFERENCE_TABLE_TYPES) {
      const file = await readTableFile(type);
      const parsed = parseReferenceTableCsv(file.name, await file.text());
      if (!parsed.ok) throw new Error(parsed.reason);
      const values = [
        type,
        file.name,
        JSON.stringify(parsed.table.columns),
        JSON.stringify(parsed.table.rows),
      ].map((value) => `'${value.replaceAll("'", "''")}'`);
      statements.push(
        `INSERT INTO \`reference_table\` (\`type\`, \`file_name\`, \`columns\`, \`rows\`, \`row_count\`) VALUES (${values.join(", ")}, ${parsed.table.rows.length});`,
      );
    }
    const expected = [
      "-- Reference Tables from data/02_tabel (issue #12), so the admin sees them without uploading.",
      "-- Generated by packages/api/src/modules/reference-tables/service.test.ts; do not edit by hand.",
      statements.join("\n--> statement-breakpoint\n"),
      "",
    ].join("\n");

    const folder = (await readdir(MIGRATIONS_DIR)).find((name) =>
      name.endsWith("_seed-reference-tables"),
    );
    if (!folder) throw new Error("seed-reference-tables migration is missing");
    const path = join(MIGRATIONS_DIR, folder, "migration.sql");
    if (process.env.UPDATE_REFERENCE_SEED) await writeFile(path, expected);

    expect(await readFile(path, "utf8")).toBe(expected);
  });
});
