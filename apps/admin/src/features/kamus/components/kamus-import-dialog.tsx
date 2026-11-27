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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheetIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/shared/api/orpc";

/** Imports Kamus Kendala rows from an Excel sheet or JSON file; a row with a known code replaces it. */
export default function KamusImportDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const queryClient = useQueryClient();
  const importExcel = useMutation(
    orpc.importKamus.mutationOptions({
      onSuccess: ({ imported, skipped }) => {
        setOpen(false);
        toast.success(`${imported} entri diimpor`, {
          description: skipped.length
            ? `Dilewati: ${skipped.map((row) => `baris ${row.row} (${row.reason})`).join(", ")}`
            : undefined,
        });
      },
      onError: (error) => toast.error(error.message),
      onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.listKamus.key() }),
    }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setFile(null);
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <FileSpreadsheetIcon />
        Impor file
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Impor dari Excel atau JSON</DialogTitle>
          <DialogDescription>
            Sheet pertama dengan kolom Kode, Aplikasi, Pesan error, Arti, Kesalahan guru (Ya/Tidak),
            Yang memperbaiki, dan Yang dilakukan, atau file JSON kamus (no, aplikasi, pesan, arti,
            siapa, langkah). Kode yang sudah ada diganti; no. 7 menjadi K-07.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (file) importExcel.mutate({ file });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="kamus-file">File Excel atau JSON</Label>
            <Input
              id="kamus-file"
              type="file"
              accept=".xlsx,.xls,.json"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Batal</DialogClose>
            <Button type="submit" disabled={!file || importExcel.isPending}>
              {importExcel.isPending && <Spinner />}
              Impor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
