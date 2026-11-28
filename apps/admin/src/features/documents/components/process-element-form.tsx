import { Button } from "@nemu/ui/components/button";
import { Input } from "@nemu/ui/components/input";
import { Label } from "@nemu/ui/components/label";
import { Spinner } from "@nemu/ui/components/spinner";
import { Textarea } from "@nemu/ui/components/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { invalidateProcessElements } from "@/features/documents/api/process-detail";
import { orpc } from "@/shared/api/orpc";

type EditableElement = {
  elementId: string;
  kind: "task" | "end" | "event";
  name: string;
  symptoms: string[];
  role: string | null;
  page: string | null;
};

/**
 * F3-11 / F3-19: corrects one BPMN element in place: the symptoms a teacher or parent sees there
 * (one per line), who at school can help, and for a task the page it is done on.
 */
export default function ProcessElementForm({
  documentId,
  element,
  onDone,
}: {
  documentId: string;
  element: EditableElement;
  onDone?: () => void;
}) {
  const [symptoms, setSymptoms] = useState(element.symptoms.join("\n"));
  const [page, setPage] = useState(element.page ?? "");
  const [role, setRole] = useState(element.role ?? "");
  const queryClient = useQueryClient();
  const save = useMutation(
    orpc.saveProcessElement.mutationOptions({
      onSuccess: () => {
        toast.success(`${element.name} disimpan`);
        onDone?.();
      },
      onError: (error) => toast.error(error.message),
      onSettled: () => invalidateProcessElements(queryClient),
    }),
  );
  const fieldId = `${documentId}-${element.elementId}`;

  return (
    <form
      className="grid gap-3 rounded-2xl border p-4"
      aria-label={`Ubah ${element.name}`}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({
          id: documentId,
          elementId: element.elementId,
          symptoms: symptoms
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          page: element.kind === "task" ? page : null,
          role: role.trim() || null,
        });
      }}
    >
      {element.kind === "task" && (
        <div className="grid gap-2">
          <Label htmlFor={`${fieldId}-page`}>Halaman</Label>
          <Input
            id={`${fieldId}-page`}
            placeholder="Al-Quran › Setoran baru"
            value={page}
            onChange={(event) => setPage(event.target.value)}
          />
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor={`${fieldId}-symptoms`}>Gejala</Label>
        <Textarea
          id={`${fieldId}-symptoms`}
          placeholder="nilai tidak muncul di aplikasi orang tua"
          value={symptoms}
          onChange={(event) => setSymptoms(event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${fieldId}-role`}>Yang bisa membantu</Label>
        <Input
          id={`${fieldId}-role`}
          placeholder="bagian keuangan"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2">
        {onDone && (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Batal
          </Button>
        )}
        <Button type="submit" size="sm" variant="outline" disabled={save.isPending}>
          {save.isPending && <Spinner />}
          Simpan
        </Button>
      </div>
    </form>
  );
}
