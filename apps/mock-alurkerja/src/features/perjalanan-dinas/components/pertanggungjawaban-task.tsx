import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Button } from "@nemu/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { FieldGroup } from "@nemu/ui/components/field";
import { Spinner } from "@nemu/ui/components/spinner";

import DokumenUploadField from "@/features/perjalanan-dinas/components/dokumen-upload-field";
import { usePertanggungjawaban } from "@/features/perjalanan-dinas/hooks/use-pertanggungjawaban";
import { DOKUMEN_UPLOADS } from "@/features/perjalanan-dinas/lib/tasks";
import type { ProcessInstanceView } from "@/features/perjalanan-dinas/types/process-instance-view";

/**
 * The Pertanggungjawaban task: upload the trip documents, then the employee presses Kirim.
 * Once sent (State Verifikasi) it shows the task ID instead.
 */
export default function PertanggungjawabanTask({ instance }: { instance: ProcessInstanceView }) {
  const { unggah, isUnggahPending, kirim, isKirimPending, terkirim } =
    usePertanggungjawaban(instance);

  if (instance.state !== "Pertanggungjawaban") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pertanggungjawaban terkirim</CardTitle>
          <CardDescription>
            {terkirim ? `ID tugas ${terkirim.taskId}, ` : ""}status {instance.state}. Tunggu hasil
            verifikasi.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dokumen pertanggungjawaban</CardTitle>
        <CardDescription>
          Unggah semua dokumen, lalu tekan Kirim untuk diverifikasi.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {DOKUMEN_UPLOADS.map((upload) => (
            <DokumenUploadField
              key={upload.jenis}
              id={`dokumen-${upload.jenis}`}
              label={upload.label}
              nemuId={upload.nemuId}
              namaFile={
                instance.dokumen.find((dokumen) => dokumen.jenis === upload.jenis)?.namaFile
              }
              disabled={isUnggahPending}
              onFile={(file) => unggah(upload.jenis, file)}
            />
          ))}
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-end">
        <Button
          data-nemu-id={NEMU_IDS.pertanggungjawaban.kirim}
          disabled={isKirimPending}
          onClick={kirim}
        >
          {isKirimPending && <Spinner />}
          Kirim
        </Button>
      </CardFooter>
    </Card>
  );
}
