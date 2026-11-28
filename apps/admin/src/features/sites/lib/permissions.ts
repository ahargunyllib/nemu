import type { SitePermission } from "@nemu/contracts/extension";

/**
 * WS-03: what Nemu may do on a website, in the words the operator reads. `summary` is the one-line
 * sentence the website list shows: the permission, then what the teacher still presses herself.
 */
export const SITE_PERMISSIONS: Array<{
  value: SitePermission;
  label: string;
  summary: string;
  description: string;
}> = [
  {
    value: "read_fill",
    label: "Baca dan isi",
    summary: "Baca dan isi · guru menekan Simpan",
    description: "Nemu membaca halaman dan mengisi kolom. Tombol Simpan tetap ditekan guru.",
  },
  {
    value: "prepare_message",
    label: "Siapkan pesan",
    summary: "Siapkan pesan · guru menekan Kirim",
    description: "Nemu menyiapkan teks pesan; guru sendiri yang menekan Kirim.",
  },
  {
    value: "read_only",
    label: "Baca dan jelaskan saja",
    summary: "Baca dan jelaskan saja",
    description: "Nemu hanya membaca, menjelaskan, dan menunjuk. Tidak ada kolom yang diisi.",
  },
];

export function permissionSummary(permission: SitePermission): string {
  return SITE_PERMISSIONS.find((option) => option.value === permission)?.summary ?? permission;
}
