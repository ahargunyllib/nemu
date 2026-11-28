// What the mock pages save, in the mock's own D1 database (never the Nemu Service's).

import { NILAI_MOODLE } from "./data/moodle";

export interface BarisNilai {
  id: number;
  semester: string;
  kelas: string;
  mapel: string;
  jenis: string;
  nis: string;
  nama_siswa: string;
  /** null when the teacher left the cell empty; the page still shows the row. */
  skor: number | null;
  catatan: string;
  /** Email of the account that saved it. */
  guru: string;
  tanggal: string;
  /** What was assessed (the Moodle quiz's name); absent for a sheet saved on Isi nilai kelas. */
  materi?: string;
}

export interface BarisHafalan {
  id: number;
  jenis: "Setoran" | "Ujian";
  tanggal: string;
  kelas: string;
  nis: string;
  nama_siswa: string;
  surah_nomor: number | null;
  /** As typed; null means "from ayat 1" / "to the last ayat". */
  ayat_awal: number | null;
  ayat_akhir: number | null;
  jenis_ujian: string | null;
  fashohah: number | null;
  tartil: number | null;
  tajwid: number | null;
  adab: number | null;
  catatan: string;
  guru: string;
}

export type NilaiBaru = Omit<BarisNilai, "id">;
export type HafalanBaru = Omit<BarisHafalan, "id">;

/** Saves one class sheet: each student's row is replaced, so saving again edits it. */
export async function simpanNilai(db: D1Database, baris: readonly NilaiBaru[]): Promise<void> {
  if (baris.length === 0) return;
  const upsert = db.prepare(
    `INSERT INTO nilai (semester, kelas, mapel, jenis, nis, nama_siswa, skor, catatan, guru, tanggal)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (semester, kelas, mapel, jenis, nis) DO UPDATE SET
       skor = excluded.skor, catatan = excluded.catatan, guru = excluded.guru, tanggal = excluded.tanggal`,
  );
  await db.batch(
    baris.map((b) =>
      upsert.bind(
        b.semester,
        b.kelas,
        b.mapel,
        b.jenis,
        b.nis,
        b.nama_siswa,
        b.skor,
        b.catatan,
        b.guru,
        b.tanggal,
      ),
    ),
  );
}

export async function semuaNilai(db: D1Database): Promise<BarisNilai[]> {
  const { results } = await db.prepare("SELECT * FROM nilai ORDER BY id").all<BarisNilai>();
  return results;
}

/** Every grade AlurSekolah holds: the sheets saved on the page, then what Moodle synced. */
export async function nilaiTercatat(db: D1Database): Promise<BarisNilai[]> {
  return [...(await semuaNilai(db)), ...NILAI_MOODLE];
}

export async function tambahHafalan(db: D1Database, baris: readonly HafalanBaru[]): Promise<void> {
  if (baris.length === 0) return;
  const insert = db.prepare(
    `INSERT INTO hafalan (jenis, tanggal, kelas, nis, nama_siswa, surah_nomor, ayat_awal, ayat_akhir,
       jenis_ujian, fashohah, tartil, tajwid, adab, catatan, guru)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  await db.batch(
    baris.map((b) =>
      insert.bind(
        b.jenis,
        b.tanggal,
        b.kelas,
        b.nis,
        b.nama_siswa,
        b.surah_nomor,
        b.ayat_awal,
        b.ayat_akhir,
        b.jenis_ujian,
        b.fashohah,
        b.tartil,
        b.tajwid,
        b.adab,
        b.catatan,
        b.guru,
      ),
    ),
  );
}

export async function semuaHafalan(db: D1Database): Promise<BarisHafalan[]> {
  const { results } = await db.prepare("SELECT * FROM hafalan ORDER BY id").all<BarisHafalan>();
  return results;
}

export async function hapusSemua(db: D1Database): Promise<void> {
  await db.batch([db.prepare("DELETE FROM nilai"), db.prepare("DELETE FROM hafalan")]);
}
