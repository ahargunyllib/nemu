// The Reference Table types the admin can upload, with the CSV columns each one needs.
// The column lists follow the CSVs in data/02_tabel.

export type ColumnKind =
  | { kind: "integer" }
  | { kind: "text" }
  | { kind: "date" }
  | { kind: "enum"; values: readonly string[] };

export type TableColumn = { name: string } & ColumnKind;

export type ReferenceTableDefinition = {
  label: string;
  description: string;
  columns: readonly TableColumn[];
};

const integer = (name: string): TableColumn => ({ name, kind: "integer" });
const text = (name: string): TableColumn => ({ name, kind: "text" });

export const REFERENCE_TABLE_TYPES = [
  "sbm2026_uang_harian_dalam_negeri",
  "sbm2026_penginapan_dalam_negeri",
  "sbm2026_tiket_pesawat_pp_dalam_negeri",
  "sbm2026_transport_terminal_bandara",
  "kalender_libur_2026",
] as const;

export type ReferenceTableType = (typeof REFERENCE_TABLE_TYPES)[number];

export const REFERENCE_TABLES: Record<ReferenceTableType, ReferenceTableDefinition> = {
  sbm2026_uang_harian_dalam_negeri: {
    label: "SBM 2026 · Uang harian",
    description: "Daily allowance per province (luar kota, dalam kota > 8 jam, diklat).",
    columns: [
      integer("no"),
      text("provinsi"),
      integer("luar_kota"),
      integer("dalam_kota_lebih_8_jam"),
      integer("diklat"),
      text("satuan"),
      text("sumber"),
    ],
  },
  sbm2026_penginapan_dalam_negeri: {
    label: "SBM 2026 · Penginapan",
    description: "Lodging ceiling per province and golongan or jabatan.",
    columns: [
      integer("no"),
      text("provinsi"),
      integer("pejabat_negara_eselon_I"),
      integer("pejabat_negara_lainnya_eselon_II"),
      integer("eselon_III_golongan_IV"),
      integer("eselon_IV_golongan_III_II_I"),
      text("satuan"),
      text("sumber"),
    ],
  },
  sbm2026_tiket_pesawat_pp_dalam_negeri: {
    label: "SBM 2026 · Tiket pesawat PP",
    description: "Return airfare per route, business and economy.",
    columns: [
      integer("no"),
      text("kota_asal"),
      text("kota_tujuan"),
      integer("bisnis_pp"),
      integer("ekonomi_pp"),
    ],
  },
  sbm2026_transport_terminal_bandara: {
    label: "SBM 2026 · Transport bandara",
    description: "Airport or terminal transport per person per trip, per province.",
    columns: [
      integer("no"),
      text("provinsi"),
      integer("besaran_per_orang_per_kali"),
      text("sumber"),
    ],
  },
  kalender_libur_2026: {
    label: "Kalender Libur 2026",
    description: "National holidays and cuti bersama, used to count working days.",
    columns: [
      { name: "tanggal", kind: "date" },
      {
        name: "hari",
        kind: "enum",
        values: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
      },
      { name: "jenis", kind: "enum", values: ["libur_nasional", "cuti_bersama"] },
      text("keterangan"),
    ],
  },
};
