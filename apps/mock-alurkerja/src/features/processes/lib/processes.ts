import { NEMU_IDS } from "@nemu/contracts/nemu-ids";

/** Colours of a process's initials badge, as AlurKerja tells its processes apart. */
export const PROCESS_TONES = {
  orange: "bg-orange-100 text-orange-700",
  green: "bg-emerald-100 text-emerald-700",
  blue: "bg-blue-100 text-blue-700",
} as const;

export type ProcessTone = keyof typeof PROCESS_TONES;

/** Number of processes AlurKerja lists under "All processes"; the demo opens only Perjalanan Dinas. */
export const ALL_PROCESSES_COUNT = 6;

export const PERJALANAN_DINAS = { code: "PD", name: "Perjalanan Dinas", tone: "orange" } as const;

export const FAVORITE_PROCESSES = [
  {
    ...PERJALANAN_DINAS,
    description: "Dinas luar kota dan dalam kota",
    nemuId: NEMU_IDS.favoriteProcess.perjalananDinas,
    to: "/perdin/baru",
  },
  {
    code: "PC",
    name: "Pengajuan Cuti",
    tone: "green",
    description: "Cuti tahunan, sakit, dan alasan penting",
    nemuId: NEMU_IDS.favoriteProcess.pengajuanCuti,
  },
  {
    code: "R",
    name: "Reimbursement",
    tone: "blue",
    description: "Klaim biaya operasional",
    nemuId: NEMU_IDS.favoriteProcess.reimbursement,
  },
] as const satisfies readonly {
  code: string;
  name: string;
  tone: ProcessTone;
  description: string;
  nemuId: string;
  to?: "/perdin/baru";
}[];
