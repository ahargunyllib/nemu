export type ContactRole = "operator" | "kepsek" | "keuangan";
export type Honorific = "Bu" | "Pak";

/** The contacts WS-06 keeps for each school, in the order the page lists them. */
export const CONTACT_ROLES: readonly { role: ContactRole; label: string; description: string }[] = [
  { role: "operator", label: "Operator", description: "Akun, kelas, dan pemetaan mapel" },
  { role: "kepsek", label: "Kepala sekolah", description: "RHK, SKP, dan persetujuan" },
  { role: "keuangan", label: "Bagian keuangan", description: "SPP, pembayaran, dan E-Saku" },
];

export const HONORIFICS: readonly Honorific[] = ["Bu", "Pak"];

/** "4A, 4B" → ["4A", "4B"]: the comma-separated classes or subjects typed in the form. */
export function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** 6281200001001 → +62 812-0000-1001, how a WhatsApp number is usually read. */
export function formatPhone(phone: string): string {
  const match = /^62(\d{3})(\d{4})(\d+)$/u.exec(phone);
  return match ? `+62 ${match[1]}-${match[2]}-${match[3]}` : phone;
}
