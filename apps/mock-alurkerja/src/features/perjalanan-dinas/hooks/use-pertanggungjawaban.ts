import type { DokumenPertanggungjawaban } from "@nemu/contracts/process-instance";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { dokumenBelumDiunggah } from "@/features/perjalanan-dinas/lib/tasks";
import type { ProcessInstanceView } from "@/features/perjalanan-dinas/types/process-instance-view";
import { orpc } from "@/shared/api/orpc";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** Uploads and Kirim on the Pertanggungjawaban task; every change refreshes the process data. */
export function usePertanggungjawaban(instance: ProcessInstanceView) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries();

  const unggah = useMutation(
    orpc.unggahDokumenPertanggungjawaban.mutationOptions({
      onSuccess: (dokumen) => {
        toast.success(`${dokumen.namaFile} terunggah`);
        return refresh();
      },
      onError: (error) => toast.error(errorMessage(error, "Dokumen gagal diunggah")),
    }),
  );

  const kirim = useMutation(
    orpc.kirimPertanggungjawaban.mutationOptions({
      onSuccess: ({ taskId, instance: sent }) => {
        toast.success(`Tugas ${taskId} terkirim dengan status ${sent.state}`);
        return refresh();
      },
      onError: (error) => toast.error(errorMessage(error, "Pertanggungjawaban gagal dikirim")),
    }),
  );

  return {
    unggah(jenis: DokumenPertanggungjawaban, file: File) {
      unggah.mutate({ instanceId: instance.id, jenis, namaFile: file.name });
    },
    isUnggahPending: unggah.isPending,
    kirim() {
      const belum = dokumenBelumDiunggah(instance);
      if (belum.length) {
        toast.error(`Unggah dulu: ${belum.join(", ")}`);
        return;
      }
      kirim.mutate({ instanceId: instance.id });
    },
    isKirimPending: kirim.isPending,
    /** Set once Kirim succeeds: the task ID and the State it moved to. */
    terkirim: kirim.data ? { taskId: kirim.data.taskId, state: kirim.data.instance.state } : null,
  };
}
