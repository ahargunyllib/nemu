import { NEMU_IDS } from "@nemu/contracts/nemu-ids";

// Static placeholder data until the process endpoints land (#3, #4).
export type ProcessInstance = {
  id: string;
  ownerId: string;
  tujuan: string;
  provinsi: string;
  tanggalBerangkat: string;
  tanggalKembali: string;
  state: string;
  task: { label: string; nemuId: string };
};

export const DEMO_PROCESS_INSTANCES: readonly ProcessInstance[] = [
  {
    id: "PD-2026-0042",
    ownerId: "rina",
    tujuan: "Makassar",
    provinsi: "Sulawesi Selatan",
    tanggalBerangkat: "2026-11-03",
    tanggalKembali: "2026-11-05",
    state: "Pertanggungjawaban",
    task: { label: "Pertanggungjawaban", nemuId: NEMU_IDS.task.pertanggungjawaban },
  },
];

export function processInstancesOf(userId: string): ProcessInstance[] {
  return DEMO_PROCESS_INSTANCES.filter((instance) => instance.ownerId === userId);
}

const dateFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" });

export function formatTanggal(isoDate: string): string {
  return dateFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}
