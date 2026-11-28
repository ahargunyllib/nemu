import { describe, expect, it } from "vite-plus/test";

import { createMock } from "../testing/app";

const lembar = (nilai: Record<string, string>) => ({
  username: "siti.aminah",
  kelas: "4B",
  mapel: "Matematika",
  jenis: "UTS",
  baris: Object.entries(nilai).map(([nama, n]) => ({ nama, nilai: n, catatan: "" })),
});

describe("mock page", () => {
  it("checks the shared test password", async () => {
    const mock = createMock();
    const masuk = (password: string) =>
      mock.page("/masuk", { method: "POST", body: { username: "dewi.lestari", password } });

    expect((await masuk("nemu-uji-2026")).status).toBe(200);
    expect(await (await masuk("salah")).json()).toEqual({
      message: "Nama pengguna atau kata sandi tidak cocok.",
    });
  });

  it("shows each account's email for the extension to read", async () => {
    const body = await (await createMock().page("/sekolah")).json();

    expect(body).toMatchObject({
      akun: { "siti.aminah": { email: "siti.aminah@sditnusantara.sch.id" } },
    });
  });

  it("shares saved grades with every browser and replaces them on a second save", async () => {
    const mock = createMock();
    await mock.page("/nilai", {
      method: "PUT",
      body: lembar({ "Ahmad Fadli": "80", "Aisyah Zahra": "" }),
    });
    await mock.page("/nilai", { method: "PUT", body: lembar({ "Ahmad Fadli": "68" }) });

    const semua = await (await mock.page("/nilai")).json();

    expect(semua).toEqual({
      "4B|Matematika|UTS": {
        "Ahmad Fadli": { nilai: "68", catatan: "" },
        "Aisyah Zahra": { nilai: "", catatan: "" },
      },
    });
  });

  it("lists saved grades and Moodle's quiz grades for Rekap Nilai", async () => {
    const mock = createMock();
    await mock.page("/nilai", { method: "PUT", body: lembar({ "Ahmad Fadli": "80" }) });

    const daftar = await (await mock.page("/daftar-nilai")).json();

    expect(daftar).toEqual([
      expect.objectContaining({ murid: "Ahmad Fadli", jenis: "UTS", materi: "", nilai: 80 }),
      expect.objectContaining({
        murid: "Aisyah Putri Wijaya",
        kelas: "4A",
        mapel: "IPAS",
        jenis: "Kuis",
        materi: "Latihan IPAS Kelas 4A · Moodle",
        nilai: 90,
      }),
      expect.objectContaining({ murid: "Bagas Pratama", nilai: 70 }),
      expect.objectContaining({ murid: "Citra Lestari", nilai: 100 }),
    ]);
  });

  it("refuses IPAS 4A for Bu Siti, who is not assigned to it (F2-2)", async () => {
    const res = await createMock().page("/nilai", {
      method: "PUT",
      body: { ...lembar({}), kelas: "4A", mapel: "IPAS" },
    });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      message: "Anda belum ditugaskan mengampu IPAS di kelas 4A. Hubungi admin sekolah.",
    });
  });

  it("rejects a grade outside 0–100 without saving the sheet", async () => {
    const mock = createMock();
    const res = await mock.page("/nilai", {
      method: "PUT",
      body: lembar({ "Ahmad Fadli": "80", "Budi Santoso": "150" }),
    });

    expect(res.status).toBe(400);
    expect(await (await mock.page("/nilai")).json()).toEqual({});
  });

  it("scores a setoran with the 30/30/30/10 weights and keeps unscored rows as belum dinilai", async () => {
    const mock = createMock();
    const setoran = (murid: string, skor: [string, string, string, string]) => ({
      jenis: "Setoran",
      tanggal: "2026-12-01",
      murid,
      surah: "An-Naba'",
      ayat_dari: "1",
      ayat_sampai: "10",
      fashohah: skor[0],
      tartil: skor[1],
      tajwid: skor[2],
      adab: skor[3],
    });
    const res = await mock.page("/tahfidz", {
      method: "POST",
      body: {
        username: "siti.aminah",
        kelas: "4A",
        baris: [
          setoran("Aisyah Putri Wijaya", ["90", "85", "88", "95"]),
          setoran("Citra Lestari", ["90", "85", "", "95"]),
        ],
      },
    });

    expect(res.status).toBe(200);
    const riwayat = await (await mock.page("/tahfidz")).json();
    expect(riwayat).toMatchObject([
      { kelas: "4A", murid: "Aisyah Putri Wijaya", nilai: "88.4" },
      { kelas: "4A", murid: "Citra Lestari", nilai: "belum dinilai" },
    ]);
  });

  it("refuses tahfidz for a class the account is not assigned to", async () => {
    const res = await createMock().page("/tahfidz", {
      method: "POST",
      body: {
        username: "dewi.lestari",
        kelas: "5A",
        baris: [
          {
            jenis: "Ujian",
            tanggal: "2026-12-01",
            murid: "Bella Safitri",
            jenis_ujian: "Ujian Juz 30",
          },
        ],
      },
    });

    expect(res.status).toBe(403);
  });
});
