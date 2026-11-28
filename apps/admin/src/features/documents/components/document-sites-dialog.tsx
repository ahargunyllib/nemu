import { Badge } from "@nemu/ui/components/badge";
import { Button } from "@nemu/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@nemu/ui/components/dialog";
import { Spinner } from "@nemu/ui/components/spinner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import SiteChecklist from "@/features/documents/components/site-checklist";
import { invalidateKnowledge } from "@/features/documents/api/invalidate-knowledge";
import { orpc } from "@/shared/api/orpc";

/** The websites a document applies to, as badges that open the editor. */
export default function DocumentSitesDialog({
  id,
  title,
  siteIds,
}: {
  id: string;
  title: string;
  siteIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(siteIds);
  const sites = useQuery(orpc.listAllowedSites.queryOptions());
  const queryClient = useQueryClient();
  const save = useMutation(
    orpc.setDocumentSites.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        toast.success("Situs dokumen disimpan");
      },
      onError: (error) => toast.error(error.message),
      onSettled: () => invalidateKnowledge(queryClient),
    }),
  );
  const labels = siteIds.flatMap((siteId) => {
    const site = sites.data?.find((candidate) => candidate.id === siteId);
    return site ? [site.label] : [];
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSelected(siteIds);
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex flex-wrap gap-1 text-left"
            aria-label={`Ubah situs ${title}`}
          />
        }
      >
        {labels.length ? (
          labels.map((label) => (
            <Badge key={label} variant="outline">
              {label}
            </Badge>
          ))
        ) : (
          <Badge variant="outline">Semua situs</Badge>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Situs untuk {title}</DialogTitle>
          <DialogDescription>Tidak dicentang berarti berlaku di semua situs.</DialogDescription>
        </DialogHeader>
        <SiteChecklist value={selected} onChange={setSelected} />
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Batal</DialogClose>
          <Button disabled={save.isPending} onClick={() => save.mutate({ id, siteIds: selected })}>
            {save.isPending && <Spinner />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
