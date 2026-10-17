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
import { Input } from "@nemu/ui/components/input";
import { Label } from "@nemu/ui/components/label";
import { Spinner } from "@nemu/ui/components/spinner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UploadIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { listReferenceTablesQueryOptions } from "@/features/reference-tables/api/list-reference-tables";
import ReferenceTablePreview from "@/features/reference-tables/components/reference-table-preview";
import { orpc } from "@/shared/api/orpc";

export default function ReferenceTableUploadDialog() {
  const queryClient = useQueryClient();
  const tables = useQuery(listReferenceTablesQueryOptions());
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const upload = useMutation(
    orpc.uploadReferenceTable.mutationOptions({
      onSettled: () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: orpc.listReferenceTables.key() }),
          queryClient.invalidateQueries({ queryKey: orpc.getReferenceTable.key() }),
        ]),
    }),
  );
  const uploaded = upload.data;
  const uploadedLabel = tables.data?.find((table) => table.type === uploaded?.type)?.label;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setFile(null);
      setFileError(null);
      upload.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>
        <UploadIcon />
        Upload CSV
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upload table</DialogTitle>
          <DialogDescription>
            {uploaded
              ? `Recognised as ${uploadedLabel ?? uploaded.type} · ${uploaded.rowCount} rows from ${uploaded.fileName}.`
              : "Upload an SBM 2026 or Kalender Libur 2026 CSV. Nemu recognises the table from its columns and replaces the stored version."}
          </DialogDescription>
        </DialogHeader>

        {uploaded ? (
          <>
            <ReferenceTablePreview columns={uploaded.columns} rows={uploaded.rows} />
            <DialogFooter>
              <DialogClose render={<Button />}>Done</DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!file || !/\.csv$/i.test(file.name)) {
                setFileError("Choose a CSV (.csv) file");
                return;
              }
              upload.mutate(
                { file },
                { onSuccess: (table) => toast.success(`${table.fileName} uploaded`) },
              );
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="reference-table-file">CSV file</Label>
              <Input
                id="reference-table-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setFileError(null);
                  upload.reset();
                }}
              />
              {(fileError ?? upload.error) && (
                <p className="text-sm text-destructive">{fileError ?? upload.error?.message}</p>
              )}
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={upload.isPending}>
                {upload.isPending && <Spinner />}
                Upload
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
