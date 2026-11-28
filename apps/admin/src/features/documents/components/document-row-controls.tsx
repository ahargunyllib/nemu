import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@nemu/ui/components/alert-dialog";
import { Button } from "@nemu/ui/components/button";
import { Spinner } from "@nemu/ui/components/spinner";
import { Switch } from "@nemu/ui/components/switch";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, ExternalLinkIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { invalidateKnowledge } from "@/features/documents/api/invalidate-knowledge";
import { client, orpc } from "@/shared/api/orpc";

export function DocumentActiveSwitch({ id, isActive }: { id: string; isActive: boolean }) {
  const queryClient = useQueryClient();
  const setActive = useMutation(
    orpc.setDocumentActive.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSettled: () => invalidateKnowledge(queryClient),
    }),
  );

  return (
    <Switch
      aria-label="Aktif"
      checked={setActive.isPending ? setActive.variables.isActive : isActive}
      disabled={setActive.isPending}
      onCheckedChange={(checked) => setActive.mutate({ id, isActive: checked })}
    />
  );
}

export function DocumentOpenButton({ id, title }: { id: string; title: string }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Buka ${title}`}
      onClick={() => void openFile(id)}
    >
      <ExternalLinkIcon />
    </Button>
  );
}

export function DocumentDeleteButton({ id, title }: { id: string; title: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const remove = useMutation(
    orpc.deleteDocument.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        toast.success(`${title} dihapus`);
      },
      onError: (error) => toast.error(error.message),
      onSettled: () => invalidateKnowledge(queryClient),
    }),
  );

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Hapus ${title}`} />}
      >
        <Trash2Icon />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus {title}?</AlertDialogTitle>
          <AlertDialogDescription>
            Dokumen dan filenya dihapus permanen, dan Nemu berhenti menjawab darinya. Tindakan ini
            tidak bisa dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Batal</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate({ id })}
          >
            {remove.isPending && <Spinner />}
            Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

async function openFile(id: string) {
  try {
    const file = await client.getDocumentFile({ id });
    window.open(URL.createObjectURL(file), "_blank", "noopener");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "File tidak bisa dibuka");
  }
}

/** F3-03: a recorded procedure as BPMN 2.0, for bpmn.io, Camunda Modeler or another school. */
export function DocumentExportBpmnButton({
  id,
  title,
  withLabel = false,
}: {
  id: string;
  title: string;
  withLabel?: boolean;
}) {
  const exportBpmn = useMutation(
    orpc.procedureExportBpmn.mutationOptions({
      onSuccess: ({ fileName, xml }) => {
        const url = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  return (
    <Button
      variant={withLabel ? "default" : "ghost"}
      size={withLabel ? "default" : "icon-sm"}
      aria-label={`Unduh BPMN ${title}`}
      disabled={exportBpmn.isPending}
      onClick={() => exportBpmn.mutate({ documentId: id })}
    >
      {exportBpmn.isPending ? <Spinner /> : <DownloadIcon />}
      {withLabel && "Unduh BPMN"}
    </Button>
  );
}
