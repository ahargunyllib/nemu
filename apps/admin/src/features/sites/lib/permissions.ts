import type { SitePermission } from "@nemu/contracts/extension";

/** WS-03: what Nemu may do on a website, in the words the operator reads. */
export const SITE_PERMISSIONS: Array<{
  value: SitePermission;
  label: string;
  description: string;
}> = [
  {
    value: "read_fill",
    label: "Baca dan isi",
    description: "Nemu membaca halaman dan mengisi kolom. Tombol Simpan tetap ditekan guru.",
  },
  {
    value: "prepare_message",
    label: "Siapkan pesan",
    description: "Nemu menyiapkan teks pesan; guru sendiri yang menekan Kirim.",
  },
  {
    value: "read_only",
    label: "Baca saja",
    description: "Nemu hanya membaca dan menunjuk. Tidak ada kolom yang diisi.",
  },
];

export function permissionLabel(permission: SitePermission): string {
  return SITE_PERMISSIONS.find((option) => option.value === permission)?.label ?? permission;
}
