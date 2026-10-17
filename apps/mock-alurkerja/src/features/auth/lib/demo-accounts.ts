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
] as const;

export const ROLE_LABELS: Record<string, string> = {
  pegawai: "Pegawai",
  verifikator: "Verifikator",
};
