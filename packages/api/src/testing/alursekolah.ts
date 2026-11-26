/**
 * A fake AlurSekolah API v1 behind `fetch`, shaped like the spec (and the mock AlurSekolah), so
 * tests run the real client, connector and WS-07 storage with only the network replaced.
 */

export type FakeNilai = {
  id: number;
  nis: string;
  nama_siswa: string;
  kelas: string;
  semester: string;
  mapel: string;
  jenis: string;
  skor: number;
  tanggal: string;
};
export type FakeSiswa = { nis: string; nama: string; kelas: string };

export const FAKE_ALURSEKOLAH_URL = "https://uji.alursekolah.test";
export const FAKE_ALURSEKOLAH_KEY = "as_uji_fake_0123456789";

export type FakeAlurSekolah = {
  fetch: typeof fetch;
  /** Every URL requested, with the Authorization header it carried. */
  requests: { url: URL; authorization: string | null }[];
  nilai: FakeNilai[];
  siswa: FakeSiswa[];
};

function matches(row: Record<string, unknown>, query: URLSearchParams, fields: string[]) {
  return fields.every((field) => {
    const wanted = query.get(field);
    return !wanted || wanted.split(",").includes(String(row[field]));
  });
}

function list<T>(rows: T[], query: URLSearchParams) {
  const halaman = query.get("halaman");
  if (!halaman) return { data: rows, meta: { total: rows.length, halaman: null, ukuran: null } };
  const ukuran = Number(query.get("ukuran") ?? 50);
  const start = (Number(halaman) - 1) * ukuran;
  return {
    data: rows.slice(start, start + ukuran),
    meta: { total: rows.length, halaman: Number(halaman), ukuran },
  };
}

export function createFakeAlurSekolah(
  data: { nilai?: FakeNilai[]; siswa?: FakeSiswa[] } = {},
  options: { baseUrl?: string; apiKey?: string } = {},
): FakeAlurSekolah {
  const baseUrl = options.baseUrl ?? FAKE_ALURSEKOLAH_URL;
  const apiKey = options.apiKey ?? FAKE_ALURSEKOLAH_KEY;
  const fake: FakeAlurSekolah = {
    requests: [],
    nilai: data.nilai ?? [],
    siswa: data.siswa ?? [],
    async fetch(input, init) {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const authorization = new Headers(init?.headers).get("Authorization");
      fake.requests.push({ url, authorization });
      if (url.origin !== new URL(baseUrl).origin) throw new TypeError("fetch failed");
      if (authorization !== `Bearer ${apiKey}`) {
        return Response.json({ message: "Kunci API salah." }, { status: 401 });
      }
      const query = url.searchParams;
      switch (url.pathname) {
        case "/api/v1/nilai": {
          const rows = fake.nilai
            .filter((row) => matches(row, query, ["kelas", "nis", "mapel", "semester", "jenis"]))
            .map((row) => ({ ...row, kode: `NL-${String(row.id).padStart(6, "0")}` }));
          return Response.json(list(rows, query));
        }
        case "/api/v1/siswa": {
          const rows = fake.siswa
            .filter((row) => matches(row, query, ["kelas", "nis"]))
            .map((row, index) => ({ id: index + 1, ...row, aktif: true, status: "aktif" }));
          return Response.json(list(rows, query));
        }
        case "/api/v1/kelas": {
          const classes = [...new Set(fake.siswa.map((row) => row.kelas))];
          return Response.json({
            data: classes.map((kelas) => ({
              kelas,
              tingkat: Number.parseInt(kelas, 10) || null,
              siswa_aktif: fake.siswa.filter((row) => row.kelas === kelas).length,
              tambahan: false,
            })),
          });
        }
        case "/api/v1/akademik/guru/saya":
          return Response.json({
            data: {
              email: "rizal.operator@sditnusantara.sch.id",
              nama: "Rizal Pratama",
              aktif: true,
              kelas: [...new Set(fake.siswa.map((row) => row.kelas))],
              semua_kelas: true,
              wali_kelas: "",
            },
          });
        case "/api/v1/nilai/rekap":
          return Response.json({ ...list([], query), kkm: 75 });
        case "/api/v1/hafalan/setoran":
          return Response.json(list([], query));
        default:
          return Response.json({ message: "Tidak ditemukan" }, { status: 404 });
      }
    },
  };
  return fake;
}
