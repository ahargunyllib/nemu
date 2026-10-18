import type { NemuAction } from "@nemu/contracts";
import { NEMU_IDS } from "@nemu/contracts/nemu-ids";

/*
 * Test-only guided-step actions for Momen 1 and 2, as #85 specifies them. They stand in for
 * `@nemu/contracts/fixtures` until those carry notes; switch the tests over once they land.
 */

export const openPerjalananDinas: NemuAction = {
  type: "click",
  target: NEMU_IDS.favoriteProcess.perjalananDinas,
  level: "jalan_sendiri",
  label: "Membuka Perjalanan Dinas",
};

export const jenisPerjalananStep: NemuAction = {
  type: "highlight",
  target: NEMU_IDS.perdinForm.jenisPerjalanan,
  level: "arahkan",
  label: "Pilih Dinas luar kota",
  note: "Mulai dari Jenis perjalanan, pilih **Dinas luar kota**.",
};

export const kotaTujuanStep: NemuAction = {
  type: "highlight",
  target: NEMU_IDS.perdinForm.kotaTujuan,
  level: "arahkan",
  label: "Isi Makassar",
  note: "Sekarang isi Kota tujuan dengan **Makassar**, sesuai surat tugas.",
};

export const dasarPenugasanStep: NemuAction = {
  type: "highlight",
  target: NEMU_IDS.perdinForm.dasarPenugasan,
  level: "arahkan",
  label: "Pilih surat tugas",
  note: "Terakhir, pilih surat tugas yang jadi dasar perjalanan ini: **ST-090/2026 · Rapat koordinasi Makassar**.",
};

export const momentOneGuidedActions: NemuAction[] = [
  openPerjalananDinas,
  jenisPerjalananStep,
  kotaTujuanStep,
  dasarPenugasanStep,
];

export const notHotelStep: NemuAction = {
  type: "highlight",
  target: NEMU_IDS.perdinForm.lodgingNotHotel,
  level: "arahkan",
  label: "Pilih ini",
  note: 'Kamu menginap di rumah saudara, jadi pilih **"Tidak menginap di hotel"**.',
};

export const lodgingAmountStep: NemuAction = {
  type: "highlight",
  target: NEMU_IDS.perdinForm.lodgingAmount,
  level: "arahkan",
  label: "Isi Rp447.000",
  note: "Sekarang isi Nominal penginapan (30% × Rp745.000 × 2 malam)",
  value: "Rp447.000",
};

export const momentTwoGuidedActions: NemuAction[] = [notHotelStep, lodgingAmountStep];
