import { Hono } from "hono";

import {
  AKUN,
  KELAS,
  KKM,
  PEMBUAT_KUNCI_API,
  SEMESTER,
  siswaKelas,
  tingkat,
  waliKelas,
} from "../data/sekolah";
import { SISWA } from "../data/siswa";
import type { MockEnv } from "../env";
import { setoranApi } from "../hafalan";
import { nilaiTercatat, semuaHafalan, semuaNilai } from "../store";
import { GalatIsian, daftar, halamankan, saring } from "./daftar";
import { rekapNilai, type SatuanRekap } from "./rekap";

// Read-only slice of AlurSekolah API v1 (business.alursekolah.id/api/v1/openapi.json) that the
// Nemu Service reads. The school key acts like an admin key: every class is in scope.

export const api = new Hono<{ Bindings: MockEnv }>();

api.use("*", async (c, next) => {
  const kunci = /^Bearer\s+(as_\S+)$/.exec(c.req.header("Authorization") ?? "")?.[1];
  if (!kunci || kunci !== c.env.API_KEY) {
    return c.json({ message: "Kunci API salah. Kirim header Authorization: Bearer as_..." }, 401);
  }
  return next();
});

api.onError((error, c) => {
  if (error instanceof GalatIsian) return c.json({ message: error.message }, 400);
  throw error;
});

const URUT_NILAI = [
  "id",
  "kode",
  "nis",
  "nama_siswa",
  "kelas",
  "semester",
  "mapel",
  "jenis",
  "topik",
  "skor",
  "tanggal",
  "catatan",
  "guru",
] as const;

api.get("/nilai", async (c) => {
  const q = new URL(c.req.url).searchParams;
  const rows = (await nilaiTercatat(c.env.DB)).flatMap((n) =>
    n.skor === null
      ? []
      : [
          {
            id: n.id,
            kode: `NL-${String(n.id).padStart(6, "0")}`,
            nis: n.nis,
            nama_siswa: n.nama_siswa,
            kelas: n.kelas,
            semester: n.semester,
            mapel: n.mapel,
            jenis: n.jenis,
            ...(n.materi ? { topik: n.materi } : {}),
            skor: n.skor,
            tanggal: n.tanggal,
            catatan: n.catatan,
            guru: n.guru,
          },
        ],
  );
  const opsi = {
    saring: { kelas: "kelas", nis: "nis", mapel: "mapel", semester: "semester", jenis: "jenis" },
    urut: URUT_NILAI,
  } as const;
  const terpilih = saring(rows, q, opsi);
  const hitung = q.get("hitung");
  if (hitung !== null && hitung !== "mapel" && hitung !== "jenis" && hitung !== "kelas") {
    throw new GalatIsian("`hitung` harus mapel, jenis, atau kelas.");
  }
  const kelompok = hitung
    ? terpilih.reduce<Record<string, number>>((acc, r) => {
        const k = r[hitung];
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {})
    : undefined;
  return c.json({ ...halamankan(terpilih, q, opsi), ...(kelompok ? { kelompok } : {}) });
});

api.get("/nilai/rekap", async (c) => {
  const q = new URL(c.req.url).searchParams;
  const per = q.get("per") ?? "siswa";
  if (per !== "siswa" && per !== "mapel" && per !== "kelas") {
    throw new GalatIsian("`per` harus siswa, mapel, atau kelas.");
  }
  const semester = q.get("semester") || SEMESTER;
  const nilai = saring(
    (await semuaNilai(c.env.DB)).filter((n) => n.semester === semester),
    q,
    { saring: { kelas: "kelas", nis: "nis", mapel: "mapel" }, cari: [] },
  );
  const rows = rekapNilai(nilai, per as SatuanRekap);
  return c.json({
    ...daftar(rows, q, { cari: ["nis", "nama_siswa", "kelas", "mapel"] }),
    kkm: KKM,
  });
});

api.get("/siswa", (c) => {
  const q = new URL(c.req.url).searchParams;
  const rows = SISWA.map((s, i) => ({
    id: i + 1,
    nis: s.nis,
    nama: s.nama,
    kelas: s.kelas,
    tingkat: tingkat(s.kelas) ?? 0,
    wali_kelas: waliKelas(s.kelas) ?? "",
    aktif: true,
    jenjang: "SD",
    status: "aktif" as const,
  }));
  return c.json(
    daftar(rows, q, {
      saring: {
        kelas: "kelas",
        nis: "nis",
        tingkat: "tingkat",
        jenjang: "jenjang",
        status: "status",
        aktif: "aktif",
      },
      cari: ["nama", "nis"],
    }),
  );
});

api.get("/kelas", (c) =>
  c.json({
    data: KELAS.map((kelas) => ({
      kelas,
      tingkat: tingkat(kelas),
      siswa_aktif: siswaKelas(kelas).length,
      tambahan: false,
    })),
  }),
);

api.get("/akademik/guru/saya", (c) => {
  const akun = AKUN[PEMBUAT_KUNCI_API];
  return c.json({
    data: {
      email: akun?.email ?? "",
      nama: akun?.nama ?? "",
      aktif: true,
      kelas: [...KELAS],
      semua_kelas: true,
      wali_kelas: akun?.wali ?? "",
    },
  });
});

api.get("/hafalan/setoran", async (c) => {
  const q = new URL(c.req.url).searchParams;
  const dari = q.get("dari");
  const sampai = q.get("sampai");
  const rows = (await semuaHafalan(c.env.DB))
    .filter((h) => h.jenis === "Setoran")
    .map(setoranApi)
    .filter((s) => (!dari || s.tanggal >= dari) && (!sampai || s.tanggal <= sampai))
    // Terbaru dulu.
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.id - a.id);
  return c.json(
    daftar(rows, q, {
      saring: {
        nis: "nis",
        kelas: "kelas",
        tanggal: "tanggal",
        juz: "juz",
        penilaian: "penilaian",
      },
    }),
  );
});
