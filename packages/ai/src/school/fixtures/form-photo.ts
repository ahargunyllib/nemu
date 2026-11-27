import type { ModelFormPhoto } from "../bpmn/form-photo.js";
import { stripJpegMetadata } from "../image.js";
import { base64ToBytes } from "../llm.js";

/**
 * Offline photo reading (`NEMU_RESPONDER=fixture`) for any BPMN form: a known test photo, found by
 * the SHA-256 of its bytes without metadata (an upload strips it), reads as what a model reads
 * from it. Any other photo reads as unreadable, so offline Nemu asks for a new photo instead of
 * inventing rows.
 */

/** SHA-256 of the official `F3-1_foto-buku-setoran-tahfidz-4A.jpg` after `stripJpegMetadata`. */
export const F3_1_PHOTO_SHA256 = "238a1e80fdf9aadf5214ae913dcefafe2931620a0a521421ae494c92b30094e3";

type Cell = ModelFormPhoto["rows"][number]["cells"][number];
const cell = (field: string, value: string | null, box: Cell["box"] = null): Cell => ({
  field,
  value,
  unreadable: value === null,
  candidates: [],
  box,
});

/**
 * The setoran book page as a model reads it against "Isi setoran satu kelas": three students,
 * "Ayat 1-3" split into its two fields, and Citra's Tajwid scribbled out (unreadable, asked).
 */
export const F3_1_READING: ModelFormPhoto = {
  readable: true,
  key_field: null,
  header: [],
  rows: [
    {
      line: 1,
      name: "Aisyah Putri Wijaya",
      box: [150, 280, 900, 350],
      cells: [
        cell("surah", "Al-'Asr"),
        cell("ayat_dari", "1"),
        cell("ayat_sampai", "3"),
        cell("fashohah", "90"),
        cell("tartil", "85"),
        cell("tajwid", "88"),
        cell("adab", "95"),
      ],
    },
    {
      line: 2,
      name: "Bagas Pratama",
      box: [150, 365, 900, 435],
      cells: [
        cell("surah", "Al-Kautsar"),
        cell("ayat_dari", "1"),
        cell("ayat_sampai", "3"),
        cell("fashohah", "80"),
        cell("tartil", "78"),
        cell("tajwid", "75"),
        cell("adab", "90"),
      ],
    },
    {
      line: 3,
      name: "Citra Lestari",
      box: [150, 445, 900, 520],
      cells: [
        cell("surah", "Al-Humazah"),
        cell("ayat_dari", "1"),
        cell("ayat_sampai", "9"),
        cell("fashohah", "92"),
        cell("tartil", "90"),
        cell("tajwid", null, [730, 440, 790, 490]),
        cell("adab", "95"),
      ],
    },
  ],
};

const UNREADABLE: ModelFormPhoto = { readable: false, key_field: null, header: [], rows: [] };

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function fixtureFormPhoto(dataUrl: string): Promise<ModelFormPhoto> {
  const base64 = dataUrl.split(",", 2)[1];
  if (!base64) return UNREADABLE;
  const hash = await sha256(stripJpegMetadata(base64ToBytes(base64)));
  return hash === F3_1_PHOTO_SHA256 ? F3_1_READING : UNREADABLE;
}
