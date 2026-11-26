import { describe, expect, it } from "vite-plus/test";

import {
  FAKE_ALURSEKOLAH_KEY,
  FAKE_ALURSEKOLAH_URL,
  createFakeAlurSekolah,
} from "../../testing/alursekolah";
import { AlurSekolahError, createAlurSekolahClient, normalizeAlurSekolahBaseUrl } from "./client";

const NILAI = {
  id: 7,
  nis: "1001",
  nama_siswa: "Adi Saputra",
  kelas: "4B",
  semester: "2026/2027 Ganjil",
  mapel: "Matematika",
  jenis: "UTS",
  skor: 77,
  tanggal: "2026-11-20",
};

describe("AlurSekolah API v1 client", () => {
  it("reads every endpoint Nemu uses with the school's key as a Bearer token", async () => {
    const fake = createFakeAlurSekolah({
      nilai: [NILAI],
      siswa: [{ nis: "1001", nama: "Adi Saputra", kelas: "4B" }],
    });
    const client = createAlurSekolahClient({
      baseUrl: FAKE_ALURSEKOLAH_URL,
      apiKey: FAKE_ALURSEKOLAH_KEY,
      fetch: fake.fetch,
    });

    const nilai = await client.nilai({ kelas: "4B", mapel: "Matematika", jenis: "UTS" });
    expect(nilai.data).toEqual([{ ...NILAI, kode: "NL-000007" }]);
    expect((await client.siswa({ kelas: "4B" })).data[0]).toMatchObject({ nama: "Adi Saputra" });
    expect((await client.kelas()).data).toEqual([
      { kelas: "4B", tingkat: 4, siswa_aktif: 1, tambahan: false },
    ]);
    expect((await client.guruSaya()).data.nama).toBe("Rizal Pratama");
    expect((await client.nilaiRekap({ per: "siswa" })).kkm).toBe(75);
    expect((await client.hafalanSetoran({ kelas: "4A" })).data).toEqual([]);

    expect(fake.requests.map(({ url }) => url.pathname + url.search)).toEqual([
      "/api/v1/nilai?kelas=4B&mapel=Matematika&jenis=UTS",
      "/api/v1/siswa?kelas=4B",
      "/api/v1/kelas",
      "/api/v1/akademik/guru/saya",
      "/api/v1/nilai/rekap?per=siswa",
      "/api/v1/hafalan/setoran?kelas=4A",
    ]);
    expect(new Set(fake.requests.map((request) => request.authorization))).toEqual(
      new Set([`Bearer ${FAKE_ALURSEKOLAH_KEY}`]),
    );
  });

  it("takes the school's address with or without /api/v1", () => {
    expect(normalizeAlurSekolahBaseUrl("https://sekolah.alursekolah.id/api/v1/")).toBe(
      "https://sekolah.alursekolah.id",
    );
    expect(normalizeAlurSekolahBaseUrl(" https://sekolah.alursekolah.id// ")).toBe(
      "https://sekolah.alursekolah.id",
    );
  });

  it("reports a refused key, an unreachable host and an off-spec answer without the key", async () => {
    const fake = createFakeAlurSekolah();
    const refused = createAlurSekolahClient({
      baseUrl: FAKE_ALURSEKOLAH_URL,
      apiKey: "as_salah_123",
      fetch: fake.fetch,
    });
    const error = await refused.nilai().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AlurSekolahError);
    expect(error).toMatchObject({ kind: "unauthorized", status: 401 });
    expect(String((error as Error).message)).not.toContain("as_salah_123");

    const offline = createAlurSekolahClient({
      baseUrl: "https://lain.test",
      apiKey: FAKE_ALURSEKOLAH_KEY,
      fetch: fake.fetch,
    });
    await expect(offline.kelas()).rejects.toMatchObject({ kind: "unreachable" });

    const offSpec = createAlurSekolahClient({
      baseUrl: FAKE_ALURSEKOLAH_URL,
      apiKey: FAKE_ALURSEKOLAH_KEY,
      fetch: async () => Response.json({ data: [{ kelas: "4B" }] }),
    });
    await expect(offSpec.kelas()).rejects.toMatchObject({ kind: "bad_response" });
  });
});
