import type { Procedure } from "@nemu/contracts/school";
import { Badge } from "@nemu/ui/components/badge";
import { Button } from "@nemu/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { Input } from "@nemu/ui/components/input";
import { Label } from "@nemu/ui/components/label";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { Spinner } from "@nemu/ui/components/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nemu/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DocumentExportBpmnButton } from "@/features/documents/components/document-row-controls";
import { deleteStep, renameParameter, valueText } from "@/features/recording/lib/edit-procedure";
import { invalidateKnowledge } from "@/features/documents/api/invalidate-knowledge";
import { orpc } from "@/shared/api/orpc";

const ACTIONS: Record<Procedure["steps"][number]["action"], string> = {
  click: "Klik",
  fill: "Isi",
  select: "Pilih",
  navigate: "Buka",
};

/**
 * F3-02 (#214): the operator reviews what "Rekam cara" captured. Nemu turns the recording into
 * steps with inputs (`procedureCompile`); the operator renames inputs, deletes steps or records
 * again, then saves it as knowledge (`procedureSave`) and can download it as BPMN.
 */
export default function RecordingReview({ recordingId }: { recordingId: string }) {
  const queryClient = useQueryClient();
  const recording = useQuery(orpc.procedureRecording.queryOptions({ input: { recordingId } }));
  const compiled = useQuery({
    ...orpc.procedureCompile.queryOptions({
      input: {
        title: recording.data?.title ?? "",
        events: recording.data?.events ?? [],
        narration: recording.data?.narration ?? [],
      },
    }),
    enabled: !!recording.data,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const [draft, setDraft] = useState<Procedure | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  useEffect(() => {
    if (compiled.data) setDraft({ ...compiled.data, recordedBy: recording.data?.recordedBy });
  }, [compiled.data, recording.data?.recordedBy]);
  const save = useMutation(
    orpc.procedureSave.mutationOptions({
      onSuccess: (document) => {
        setSavedId(document.id);
        toast.success(`${document.title} disimpan`);
      },
      onError: (error) => toast.error(error.message),
      onSettled: () => invalidateKnowledge(queryClient),
    }),
  );

  if (recording.error) return <p className="text-destructive">{recording.error.message}</p>;
  if (!recording.data || !draft) return <Skeleton className="h-96 w-full" />;
  const firstUrl = recording.data.events[0]?.url;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Rekaman {recording.data.recordedBy}</CardTitle>
          <CardDescription>
            {draft.steps.length} langkah, {recording.data.narration.length} penjelasan suara.
            Langkah bertanda “dikerjakan guru” tidak pernah dikerjakan Nemu.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="judul-cara">Nama cara</Label>
            <Input
              id="judul-cara"
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="direkam-oleh">Direkam oleh</Label>
            <Input
              id="direkam-oleh"
              value={draft.recordedBy ?? ""}
              onChange={(event) => setDraft({ ...draft, recordedBy: event.target.value })}
            />
          </div>
          {recording.data.narration.length > 0 && (
            <ul className="grid gap-1 text-muted-foreground">
              {recording.data.narration.map((segment) => (
                <li key={`${segment.start}-${segment.text}`}>
                  {(segment.start / 1000).toFixed(1)} dtk: “{segment.text}”
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Isian</CardTitle>
          <CardDescription>
            Nilai yang berbeda tiap kali dipakai. Nemu menanyakannya kepada guru sebelum mengisi.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {draft.parameters.length === 0 && (
            <p className="text-muted-foreground">Tidak ada isian.</p>
          )}
          {draft.parameters.map((parameter) => (
            <div key={parameter.name} className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`isian-${parameter.name}`}>Nama isian ({parameter.example})</Label>
                <Input
                  id={`isian-${parameter.name}`}
                  value={parameter.label}
                  onChange={(event) =>
                    setDraft(renameParameter(draft, parameter.name, { label: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`tanya-${parameter.name}`}>Pertanyaan untuk guru</Label>
                <Input
                  id={`tanya-${parameter.name}`}
                  value={parameter.question}
                  onChange={(event) =>
                    setDraft(
                      renameParameter(draft, parameter.name, { question: event.target.value }),
                    )
                  }
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Langkah</CardTitle>
          <CardDescription>
            Hapus langkah yang tidak perlu, misalnya klik yang keliru.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Langkah</TableHead>
                <TableHead>Nilai</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.steps.map((step) => (
                <TableRow key={step.id}>
                  <TableCell>{step.order}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{ACTIONS[step.action]}</Badge>
                      <span>{step.locator.label ?? step.locator.name}</span>
                      {step.requiresHumanAction && <Badge variant="outline">dikerjakan guru</Badge>}
                    </div>
                    <div className="text-muted-foreground">{step.instruction}</div>
                  </TableCell>
                  <TableCell>{valueText(draft, step.valueTemplate) ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Hapus langkah ${step.order}`}
                      onClick={() => setDraft(deleteStep(draft, step.id))}
                    >
                      <Trash2Icon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        {firstUrl && (
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={firstUrl} target="_blank" rel="noreferrer" />}
          >
            Rekam ulang
          </Button>
        )}
        {savedId ? (
          <>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link to="/documents" search={{ dokumen: savedId }} />}
            >
              Lihat di Dokumen dan alur
            </Button>
            <DocumentExportBpmnButton id={savedId} title={draft.title} withLabel />
          </>
        ) : (
          <Button
            disabled={save.isPending || !draft.title.trim() || draft.steps.length === 0}
            onClick={() =>
              save.mutate({
                title: draft.title.trim(),
                version: "1",
                isActive: true,
                procedure: { ...draft, recordedBy: draft.recordedBy?.trim() || undefined },
              })
            }
          >
            {save.isPending && <Spinner />}
            Simpan cara
          </Button>
        )}
      </div>
      {firstUrl && !savedId && (
        <p className="text-right text-muted-foreground">
          Rekam ulang membuka halaman yang direkam. Tekan Rekam cara di Nemu, lalu buka tautan
          rekaman yang baru.
        </p>
      )}
    </div>
  );
}
