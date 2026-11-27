// The list conventions every AlurSekolah API v1 list shares: comma-separated filters, `cari`,
// `urut`/`arah`, and `halaman`/`ukuran` (no `halaman` returns every row).

export class GalatIsian extends Error {}

type Baris = object;

const ambil = (r: Baris, k: string) => (r as Record<string, unknown>)[k];

export interface OpsiDaftar<T extends Baris> {
  /** Query parameter → field it filters, matched against a comma-separated list. */
  saring?: Readonly<Record<string, keyof T & string>>;
  /** Fields `cari` looks in; defaults to every text field. */
  cari?: readonly (keyof T & string)[];
  /** Fields `urut` accepts; defaults to every field of the rows. */
  urut?: readonly string[];
}

export interface Meta {
  total: number;
  halaman: number | null;
  ukuran: number | null;
}

function bilanganBulat(q: URLSearchParams, nama: string, min: number, max: number) {
  const mentah = q.get(nama);
  if (mentah === null || mentah === "") return null;
  const n = Number(mentah);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new GalatIsian(`\`${nama}\` harus bilangan bulat ${min} sampai ${max}.`);
  }
  return n;
}

function bandingkan(a: unknown, b: unknown) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""), "id", { numeric: true });
}

/** Rows that pass the filters and `cari`, before sorting and paging. */
export function saring<T extends Baris>(
  rows: readonly T[],
  q: URLSearchParams,
  opsi: OpsiDaftar<T>,
) {
  let hasil = [...rows];
  for (const [param, field] of Object.entries(opsi.saring ?? {})) {
    const mentah = q.get(param);
    if (!mentah) continue;
    const nilai = new Set(mentah.split(",").map((v) => v.trim()));
    hasil = hasil.filter((r) => nilai.has(String(ambil(r, field))));
  }
  const cari = q.get("cari")?.trim().toLowerCase();
  if (cari) {
    hasil = hasil.filter((r) =>
      (opsi.cari ?? Object.keys(r)).some((k) => {
        const v = ambil(r, k);
        return typeof v === "string" && v.toLowerCase().includes(cari);
      }),
    );
  }
  return hasil;
}

/** Sorts and pages rows that were already filtered. */
export function halamankan<T extends Baris>(
  rows: readonly T[],
  q: URLSearchParams,
  opsi: Pick<OpsiDaftar<T>, "urut">,
): { data: T[]; meta: Meta } {
  const arah = q.get("arah") ?? "asc";
  if (arah !== "asc" && arah !== "desc") throw new GalatIsian("`arah` harus asc atau desc.");
  const urut = q.get("urut");
  let data = [...rows];
  if (urut) {
    const boleh = opsi.urut ?? Object.keys(rows[0] ?? {});
    if (!boleh.includes(urut)) throw new GalatIsian(`\`urut\` tidak dikenal: ${urut}.`);
    data.sort((a, b) => bandingkan(ambil(a, urut), ambil(b, urut)) * (arah === "desc" ? -1 : 1));
  }
  const halaman = bilanganBulat(q, "halaman", 1, Number.MAX_SAFE_INTEGER);
  if (halaman === null) return { data, meta: { total: data.length, halaman: null, ukuran: null } };
  const ukuran = bilanganBulat(q, "ukuran", 1, 1000) ?? 50;
  const total = data.length;
  data = data.slice((halaman - 1) * ukuran, halaman * ukuran);
  return { data, meta: { total, halaman, ukuran } };
}

export function daftar<T extends Baris>(
  rows: readonly T[],
  q: URLSearchParams,
  opsi: OpsiDaftar<T>,
) {
  return halamankan(saring(rows, q, opsi), q, opsi);
}
