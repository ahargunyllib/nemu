import { describe, expect, it } from "vite-plus/test";

import { createMock } from "../testing/app";

type Mock = ReturnType<typeof createMock>;

async function simpanNilai(
  mock: Mock,
  isian: { username?: string; kelas: string; mapel: string; jenis: string },
  nilai: Record<string, string>,
) {
  const res = await mock.page("/nilai", {
    method: "PUT",
    body: {
      username: "siti.aminah",
      ...isian,
      baris: Object.entries(nilai).map(([nama, n]) => ({ nama, nilai: n, catatan: "" })),
    },
  });
  expect(res.status).toBe(200);
}

async function simpanSetoran(mock: Mock, baris: Record<string, string>[]) {
  const res = await mock.page("/tahfidz", {
    method: "POST",
    body: { username: "siti.aminah", kelas: "4A", baris },
  });
  expect(res.status).toBe(200);
}

describe("AlurSekolah read API", () => {
  it("requires the school key as Authorization: Bearer as_…", async () => {
    const mock = createMock();

    expect((await mock.api("/kelas", "")).status).toBe(401);
    expect((await mock.api("/kelas", "Bearer as_kunci_lain")).status).toBe(401);
    expect((await mock.api("/kelas", "as_kunci_uji")).status).toBe(401);
    expect((await mock.api("/kelas")).status).toBe(200);
  });

  it("lists the grades saved on the page, leaving out empty cells", async () => {
    const mock = createMock();
    await simpanNilai(
      mock,
      { kelas: "4B", mapel: "Matematika", jenis: "UTS" },
      { "Ahmad Fadli": "80", "Aisyah Zahra": "", "Budi Santoso": "62" },
    );

    const body = await (await mock.api("/nilai?kelas=4B&mapel=Matematika&jenis=UTS")).json();

    expect(body).toEqual({
      meta: { total: 2, halaman: null, ukuran: null },
      data: [
        {
          id: 1,
          kode: "NL-000001",
          nis: "0159870001",
          nama_siswa: "Ahmad Fadli",
          kelas: "4B",
          semester: "2026/2027 Ganjil",
          mapel: "Matematika",
          jenis: "UTS",
          skor: 80,
          tanggal: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          catatan: "",
          guru: "siti.aminah@sditnusantara.sch.id",
        },
        expect.objectContaining({ nama_siswa: "Budi Santoso", skor: 62 }),
      ],
    });
  });

  it("lists the Moodle quiz grades that came in after a sync as jenis Kuis (F4)", async () => {
    const mock = createMock();
    await mock.page("/reset", { method: "POST", body: {} });

    const body = await (await mock.api("/nilai?jenis=Kuis")).json();

    expect(body.meta.total).toBe(3);
    expect(
      body.data.map((n: { nama_siswa: string; skor: number }) => [n.nama_siswa, n.skor]),
    ).toEqual([
      ["Aisyah Putri Wijaya", 90],
      ["Bagas Pratama", 70],
      ["Citra Lestari", 100],
    ]);
    expect(body.data[0]).toMatchObject({
      kelas: "4A",
      mapel: "IPAS",
      jenis: "Kuis",
      topik: "Latihan IPAS Kelas 4A · Moodle",
      tanggal: "2026-12-10",
    });
  });

  it("filters, counts, and pages grades the way the spec describes", async () => {
    const mock = createMock();
    await simpanNilai(
      mock,
      { kelas: "4B", mapel: "Matematika", jenis: "UTS" },
      { "Ahmad Fadli": "80", "Budi Santoso": "62" },
    );
    await simpanNilai(
      mock,
      { kelas: "4B", mapel: "Bahasa Indonesia", jenis: "Harian" },
      { "Ahmad Fadli": "90" },
    );

    const counted = await (await mock.api("/nilai?nis=0159870001&hitung=mapel")).json();
    expect(counted).toMatchObject({ kelompok: { Matematika: 1, "Bahasa Indonesia": 1 } });

    const paged = await (
      await mock.api("/nilai?kelas=4B&urut=skor&arah=desc&halaman=2&ukuran=1")
    ).json();
    expect(paged).toEqual({
      meta: { total: 3, halaman: 2, ukuran: 1 },
      data: [expect.objectContaining({ skor: 80 })],
    });

    expect((await mock.api("/nilai?urut=password")).status).toBe(400);
  });

  it("summarises grades per student, subject, and class against KKM 75", async () => {
    const mock = createMock();
    await simpanNilai(
      mock,
      { kelas: "4B", mapel: "Matematika", jenis: "Harian" },
      { "Ahmad Fadli": "70", "Budi Santoso": "90" },
    );
    await simpanNilai(
      mock,
      { kelas: "4B", mapel: "Matematika", jenis: "UTS" },
      { "Ahmad Fadli": "90", "Budi Santoso": "60" },
    );
    await simpanNilai(
      mock,
      { kelas: "4B", mapel: "Bahasa Indonesia", jenis: "UTS" },
      { "Ahmad Fadli": "70" },
    );

    const siswa = await (await mock.api("/nilai/rekap?nis=0159870001")).json();
    expect(siswa).toMatchObject({ kkm: 75 });
    expect(siswa).toMatchObject({
      data: [
        {
          nis: "0159870001",
          nama_siswa: "Ahmad Fadli",
          kelas: "4B",
          semester: "2026/2027 Ganjil",
          rata: 75,
          jumlah: 2,
          tuntas: false,
          mapel: [
            { mapel: "Matematika", nilai_akhir: 80, jumlah: 2, tuntas: true },
            { mapel: "Bahasa Indonesia", nilai_akhir: 70, jumlah: 1, tuntas: false },
          ],
        },
      ],
    });

    const mapel = await (await mock.api("/nilai/rekap?per=mapel&mapel=Matematika")).json();
    expect(mapel).toMatchObject({
      data: [{ mapel: "Matematika", rata: 77.5, jumlah: 4, siswa: 2, tuntas_persen: 100 }],
    });

    const kelas = await (await mock.api("/nilai/rekap?per=kelas")).json();
    expect(kelas).toMatchObject({
      data: [{ kelas: "4B", rata: 75, jumlah: 5, siswa: 2, tuntas_persen: 50 }],
    });
  });

  it("serves the seeded students and classes from 01_profil-sekolah", async () => {
    const mock = createMock();

    const kelas = await (await mock.api("/kelas")).json();
    expect(kelas).toEqual({
      data: [
        { kelas: "4A", tingkat: 4, siswa_aktif: 10, tambahan: false },
        { kelas: "4B", tingkat: 4, siswa_aktif: 32, tambahan: false },
        { kelas: "5A", tingkat: 5, siswa_aktif: 20, tambahan: false },
      ],
    });

    const siswa = await (await mock.api("/siswa?kelas=4A&cari=wijaya")).json();
    expect(siswa).toMatchObject({
      data: [
        {
          nis: "4101",
          nama: "Aisyah Putri Wijaya",
          wali_kelas: "Siti Aminah, S.Pd.",
          aktif: true,
          status: "aktif",
        },
        { nis: "4102", nama: "Fatih Rizky Wijaya" },
        { nis: "4103", nama: "Zahra Nur Wijaya" },
      ],
      meta: { total: 3 },
    });
  });

  it("answers Penugasan saya for the school key with every class in scope", async () => {
    const body = await (await createMock().api("/akademik/guru/saya")).json();

    expect(body).toEqual({
      data: {
        email: "rizal.operator@sditnusantara.sch.id",
        nama: "Rizal Pratama",
        aktif: true,
        kelas: ["4A", "4B", "5A"],
        semua_kelas: true,
        wali_kelas: "",
      },
    });
  });

  it("lists saved setoran newest first in the spec's shape, without exam records", async () => {
    const mock = createMock();
    const skor = { fashohah: "90", tartil: "85", tajwid: "88", adab: "95" };
    await simpanSetoran(mock, [
      {
        jenis: "Setoran",
        tanggal: "2026-11-30",
        murid: "Bagas Pratama",
        surah: "Al-Mulk",
        ...skor,
      },
    ]);
    await simpanSetoran(mock, [
      {
        jenis: "Setoran",
        tanggal: "2026-12-01",
        murid: "Aisyah Putri Wijaya",
        surah: "Al-Baqarah",
        ayat_dari: "142",
        ayat_sampai: "150",
        ...skor,
        tajwid: "",
      },
      {
        jenis: "Ujian",
        tanggal: "2026-12-01",
        murid: "Citra Lestari",
        jenis_ujian: "Ujian Juz 30",
        ...skor,
      },
    ]);

    const body = await (await mock.api("/hafalan/setoran?kelas=4A")).json();

    expect(body).toMatchObject({
      meta: { total: 2 },
      data: [
        {
          kode: "ST-000002",
          nis: "4101",
          tanggal: "2026-12-01",
          juz: 2,
          ayat: 9,
          surah_nomor: 2,
          surah_nama: "Al-Baqarah",
          ayat_awal: 142,
          ayat_akhir: 150,
          skor: { fashohah: 90, tartil: 85, adab: 95 },
          nilai: null,
          label: "Al-Baqarah, ayat 142-150",
        },
        {
          nis: "4104",
          juz: 29,
          ayat: 30,
          nilai: 88.4,
          label: "Al-Mulk, ayat 1-30 (utuh)",
          guru: "siti.aminah@sditnusantara.sch.id",
        },
      ],
    });
  });
});
