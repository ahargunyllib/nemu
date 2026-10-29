import { NEMU_IDS } from "@nemu/contracts/nemu-ids";

// Seeded by packages/db/src/migrations/*_seed-demo-accounts; see docs/demo-app.md.
export const DEMO_ACCOUNTS = [
  {
    nemuId: NEMU_IDS.login.signInAsRina,
    label: "Masuk sebagai Rina (Pegawai, III/a)",
    email: "rina@nemu.demo",
    password: "rina-demo-2026",
  },
  {
    nemuId: NEMU_IDS.login.signInAsVerifikator,
    label: "Masuk sebagai Verifikator",
    email: "verifikator@nemu.demo",
    password: "verifikator-demo-2026",
  },
  {
    nemuId: NEMU_IDS.login.signInAsDimas,
    label: "Masuk sebagai Dimas (Billing Liaison)",
    email: "dimas@nemu.demo",
    password: "dimas-demo-2026",
  },
] as const;

/** The jabatan the side menu shows under each demo role's name. */
export const JABATAN_LABELS: Record<string, string> = {
  pegawai: "Pranata Komputer",
  verifikator: "Verifikator Keuangan",
  billing_liaison: "Billing Liaison",
};
