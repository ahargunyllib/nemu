import { Badge } from "@nemu/ui/components/badge";
import { Button } from "@nemu/ui/components/button";
import { Input } from "@nemu/ui/components/input";
import { Label } from "@nemu/ui/components/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@nemu/ui/components/sheet";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { Spinner } from "@nemu/ui/components/spinner";
import { Textarea } from "@nemu/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { WorkflowIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/shared/api/orpc";

type ProcessElement = {
  elementId: string;
  kind: "task" | "end" | "event";
  name: string;
  symptoms: string[];
  role: string | null;
  page: string | null;
  pageEdited: boolean;
};

/**
 * F3-11 / F3-19: a BPMN's tasks, events and end events. The operator corrects the symptoms a
 * teacher sees there, who at school can help, and the page each user task is done on.
 */
export default function ProcessElementsSheet({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);
  const elements = useQuery({
    ...orpc.listProcessElements.queryOptions({ input: { id } }),
    enabled: open,
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Gejala dan halaman ${title}`} />
        }
      >
        <WorkflowIcon />
      </SheetTrigger>
      <SheetContent className="data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Gejala yang dilihat guru atau orang tua di langkah ini, siapa di sekolah yang bisa
            membantu, dan halaman tempat tugas dikerjakan. Satu gejala per baris.
          </SheetDescription>
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            nativeButton={false}
            render={<Link to="/process-diagram" search={{ document: id }} />}
          >
            Lihat diagram
          </Button>
        </SheetHeader>
        <div className="grid gap-4 overflow-y-auto px-4 pb-4">
          {elements.data
            ? elements.data.map((element) => (
                <ElementEditor key={element.elementId} documentId={id} element={element} />
              ))
            : ["a", "b", "c"].map((key) => <Skeleton key={key} className="h-32 w-full" />)}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ElementEditor({ documentId, element }: { documentId: string; element: ProcessElement }) {
  const [symptoms, setSymptoms] = useState(element.symptoms.join("\n"));
  const [page, setPage] = useState(element.page ?? "");
  const [role, setRole] = useState(element.role ?? "");
  const queryClient = useQueryClient();
  const save = useMutation(
    orpc.saveProcessElement.mutationOptions({
      onSuccess: () => toast.success(`${element.name} disimpan`),
      onError: (error) => toast.error(error.message),
      onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.listProcessElements.key() }),
    }),
  );
  const fieldId = `${documentId}-${element.elementId}`;

  return (
    <form
      className="grid gap-3 rounded-2xl border p-4"
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
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{element.name}</span>
        <Badge variant="secondary">
          {element.kind === "task"
            ? "Tugas"
            : element.kind === "event"
              ? "Peristiwa"
              : "Akhir proses"}
        </Badge>
      </div>
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
      {element.kind === "task" && (
        <div className="grid gap-2">
          <Label htmlFor={`${fieldId}-page`}>Halaman</Label>
          <Input
            id={`${fieldId}-page`}
            value={page}
            onChange={(event) => setPage(event.target.value)}
          />
          {!element.pageEdited && element.page && (
            <p className="text-muted-foreground">Diambil dari nama tugas. Ubah bila berbeda.</p>
          )}
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="outline" disabled={save.isPending}>
          {save.isPending && <Spinner />}
          Simpan
        </Button>
      </div>
    </form>
  );
}
