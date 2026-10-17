import { type AjukanPerjalananDinasInput, KOTA_TUJUAN } from "@nemu/contracts/process-instance";

import type { ProcessInstanceRecord, ProcessInstanceRepository } from "./repository";

export type ProcessInstanceDeps = {
  processInstances: ProcessInstanceRepository;
};

// Nomor pengajuan: PD-<year of departure>-<4-digit sequence within that year>.
async function nextNomorPengajuan(
  processInstances: ProcessInstanceRepository,
  tanggalBerangkat: string,
): Promise<string> {
  const prefix = `PD-${tanggalBerangkat.slice(0, 4)}-`;
  const last = await processInstances.lastIdWithPrefix(prefix);
  const sequence = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

/** Kirim on the Ajukan Perjalanan Dinas form: the new Process Instance starts in State Diajukan. */
export async function ajukanPerjalananDinas(
  { processInstances }: ProcessInstanceDeps,
  ownerId: string,
  input: AjukanPerjalananDinasInput,
): Promise<ProcessInstanceRecord> {
  return processInstances.insert({
    ...input,
    id: await nextNomorPengajuan(processInstances, input.tanggalBerangkat),
    ownerId,
    state: "Diajukan",
    provinsi: KOTA_TUJUAN[input.kotaTujuan],
  });
}

export function listMyProcessInstances({ processInstances }: ProcessInstanceDeps, ownerId: string) {
  return processInstances.listByOwner(ownerId);
}
