import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Button, buttonVariants } from "@nemu/ui/components/button";
import { Spinner } from "@nemu/ui/components/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@nemu/ui/components/tabs";
import { cn } from "@nemu/ui/lib/utils";
import { CheckIcon } from "lucide-react";

import DokumenUploadRow from "@/features/perjalanan-dinas/components/dokumen-upload-row";
import TaskSummary from "@/features/perjalanan-dinas/components/task-summary";
import { usePertanggungjawaban } from "@/features/perjalanan-dinas/hooks/use-pertanggungjawaban";
import { DOKUMEN_UPLOADS } from "@/features/perjalanan-dinas/lib/tasks";
import type { ProcessInstanceView } from "@/features/perjalanan-dinas/types/process-instance-view";

/** Tabs AlurKerja shows on a task that the demo has no content for. */
const OTHER_TABS = ["Detail", "Diagram", "Riwayat", "Diskusi"] as const;

/**
 * The Pertanggungjawaban task sheet: upload the trip documents, then the employee presses
 * Selesaikan Tugas. Once sent (State Verifikasi) the documents stay listed, read-only.
 */
export default function PertanggungjawabanTask({
  instance,
  assignee,
}: {
  instance: ProcessInstanceView;
  assignee: string;
}) {
  const { unggah, isUnggahPending, kirim, isKirimPending, terkirim } =
    usePertanggungjawaban(instance);
  const terbuka = instance.state === "Pertanggungjawaban";

  return (
    <>
      <TaskSummary instance={instance} assignee={assignee}>
        <Button
          variant="outline"
          disabled
          className="border-task-header-foreground/80 bg-transparent text-task-header-foreground"
        >
          Delegasikan
        </Button>
        {terbuka ? (
          // An upload stays pending until the refetch shows it, so this never checks stale data.
          <Button
            variant="outline"
            data-nemu-id={NEMU_IDS.pertanggungjawaban.kirim}
            disabled={isKirimPending || isUnggahPending}
            onClick={kirim}
            className="bg-background text-foreground hover:bg-muted"
          >
            {isKirimPending && <Spinner />}
            Selesaikan Tugas
          </Button>
        ) : (
          <span
            className={cn(buttonVariants({ variant: "outline" }), "bg-background text-foreground")}
          >
            Selesai
            <CheckIcon data-icon="inline-end" />
          </span>
        )}
      </TaskSummary>
      <Tabs defaultValue="form" className="min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-4">
        <TabsList className="self-center">
          <TabsTrigger value="form" className="px-4">
            Formulir
          </TabsTrigger>
          {OTHER_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} disabled className="px-4">
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="form" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="font-heading text-base font-medium">
              Unggah dokumen pertanggungjawaban
            </h3>
            <p className="text-muted-foreground">
              {terbuka
                ? "Semua dokumen wajib diunggah sebelum dikirim ke verifikator."
                : `${terkirim ? `Tugas ${terkirim.taskId} terkirim` : "Terkirim"} ke verifikator. Tunggu hasil verifikasi.`}
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {DOKUMEN_UPLOADS.map((upload) => (
              <DokumenUploadRow
                key={upload.jenis}
                label={upload.label}
                nemuId={upload.nemuId}
                namaFile={
                  instance.dokumen.find((dokumen) => dokumen.jenis === upload.jenis)?.namaFile
                }
                disabled={isUnggahPending}
                onFile={terbuka ? (file) => unggah(upload.jenis, file) : undefined}
              />
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </>
  );
}
