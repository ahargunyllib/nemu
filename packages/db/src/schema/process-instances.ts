import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { PENGINAPAN, PROCESS_STATES } from "@nemu/contracts/process-instance";

import { user } from "./auth";

// One employee's Perjalanan Dinas in the Demo App. `id` is the nomor pengajuan
// shown to the user (e.g. PD-2026-0001); amounts are whole rupiah.
export const processInstance = sqliteTable(
  "process_instance",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    state: text("state", { enum: PROCESS_STATES }).notNull(),
    jenisPerjalanan: text("jenis_perjalanan").notNull(),
    nomorSuratTugas: text("nomor_surat_tugas").notNull(),
    kotaTujuan: text("kota_tujuan").notNull(),
    provinsi: text("provinsi").notNull(),
    maksud: text("maksud").notNull(),
    tanggalBerangkat: text("tanggal_berangkat").notNull(),
    tanggalKembali: text("tanggal_kembali").notNull(),
    modaTransport: text("moda_transport").notNull(),
    biayaTransport: integer("biaya_transport").notNull(),
    penginapan: text("penginapan", { enum: PENGINAPAN }).notNull(),
    nominalPenginapan: integer("nominal_penginapan").notNull(),
    uangHarian: integer("uang_harian").notNull(),
    dokumenUndangan: text("dokumen_undangan").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("process_instance_ownerId_idx").on(table.ownerId)],
);
