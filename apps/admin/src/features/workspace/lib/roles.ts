/**
 * Admin Workspace roles. Admin Javan (`admin`, and the legacy AlurKerja `verifikator`) sees every
 * page; a school `operator` sees only its own school's knowledge and teachers.
 */
const FULL_ADMIN_ROLES: ReadonlySet<string> = new Set(["admin", "verifikator"]);

export function isFullAdmin(role: string | null | undefined): boolean {
  return FULL_ADMIN_ROLES.has(role ?? "");
}

/** Where a role lands after sign-in or on a page it can't open. */
export function homePath(role: string | null | undefined) {
  return isFullAdmin(role) ? ("/dashboard" as const) : ("/teachers" as const);
}

export function roleLabel(role: string | null | undefined): string {
  if (role === "operator") return "Operator sekolah";
  if (role === "admin") return "Admin Javan";
  return "Admin";
}
