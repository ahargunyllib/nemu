import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import type { DokumenPertanggungjawaban } from "@nemu/contracts/process-instance";

import type { ProcessInstanceView } from "@/features/perjalanan-dinas/types/process-instance-view";

type TaskKey = NonNullable<ProcessInstanceView["activeTask"]>["key"];

/** The nemu_id of a Task's link on Beranda and My Task. */
export const TASK_NEMU_IDS: Record<TaskKey, string> = {
  isi_rencana: NEMU_IDS.task.isiRencana,
  revisi: NEMU_IDS.task.revisi,
  pertanggungjawaban: NEMU_IDS.task.pertanggungjawaban,
};

/** The Pertanggungjawaban uploads in the order the task page shows them. */
export const DOKUMEN_UPLOADS: readonly {
  jenis: DokumenPertanggungjawaban;
  label: string;
  nemuId: string;
}[] = [
  {
    jenis: "surat_tugas",
    label: "Surat tugas",
    nemuId: NEMU_IDS.pertanggungjawaban.uploadSuratTugas,
  },
  {
    jenis: "boarding_pass_pergi",
    label: "Boarding pass pergi",
    nemuId: NEMU_IDS.pertanggungjawaban.uploadBoardingPassPergi,
  },
  {
    jenis: "boarding_pass_pulang",
    label: "Boarding pass pulang",
    nemuId: NEMU_IDS.pertanggungjawaban.uploadBoardingPassPulang,
  },
  {
    jenis: "laporan_perjalanan",
    label: "Laporan perjalanan",
    nemuId: NEMU_IDS.pertanggungjawaban.uploadLaporanPerjalanan,
  },
];

/** Labels of the uploads still missing from an instance, in page order. */
export function dokumenBelumDiunggah(instance: Pick<ProcessInstanceView, "dokumen">): string[] {
  const uploaded = new Set(instance.dokumen.map((dokumen) => dokumen.jenis));
  return DOKUMEN_UPLOADS.filter((upload) => !uploaded.has(upload.jenis)).map(
    (upload) => upload.label,
  );
}
