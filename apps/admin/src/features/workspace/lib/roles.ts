/**
 * Admin Workspace roles. Admin Javan (`admin`, and the legacy AlurKerja `verifikator`) sees every
 * page; a school `operator` sees its own school's pages but not the school list, the knowledge
 * package, Tables or Pengaturan Nemu (ADR-0022).
 */
const FULL_ADMIN_ROLES: ReadonlySet<string> = new Set(["admin", "verifikator"]);

export function isFullAdmin(role: string | null | undefined): boolean {
  return FULL_ADMIN_ROLES.has(role ?? "");
}

/** Where every role lands after sign-in or on a page it can't open: Ringkasan. */
export function homePath() {
  return "/dashboard" as const;
}

export function roleLabel(role: string | null | undefined): string {
  if (role === "operator") return "Operator sekolah";
  if (role === "admin") return "Admin Javan";
  return "Admin";
}
