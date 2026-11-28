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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nemu/ui/components/select";
import { Spinner } from "@nemu/ui/components/spinner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { listDocumentsQueryOptions } from "@/features/documents/api/list-documents";
import { orpc } from "@/shared/api/orpc";

type RuleSource = {
  key: string;
  label: string;
  documentId: string;
  article: string | null;
  page: number | null;
  isDefault: boolean;
};

export default function RuleSourceDialog({ source }: { source: RuleSource }) {
  const [open, setOpen] = useState(false);
  const [documentId, setDocumentId] = useState(source.documentId);
  const [article, setArticle] = useState(source.article ?? "");
  const [page, setPage] = useState(source.page?.toString() ?? "");
  const queryClient = useQueryClient();
  const documents = useQuery(listDocumentsQueryOptions());
  const options = (documents.data ?? [])
    .filter((document) => document.status === "ready")
    .map((document) => ({
      value: document.id,
      label: document.isActive ? document.title : `${document.title} (nonaktif)`,
    }));

  const onSettled = () => queryClient.invalidateQueries({ queryKey: orpc.listRuleSources.key() });
  const save = useMutation(
    orpc.setRuleSource.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        toast.success(`Sumber ${source.label} disimpan`);
      },
      onError: (error) => toast.error(error.message),
      onSettled,
    }),
  );
  const reset = useMutation(
    orpc.resetRuleSource.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        toast.success(`${source.label} kembali ke sumber bawaan`);
      },
      onError: (error) => toast.error(error.message),
      onSettled,
    }),
  );
  const pageNumber = page.trim() ? Number(page) : undefined;
  const pageInvalid = pageNumber !== undefined && !(Number.isInteger(pageNumber) && pageNumber > 0);
  const pending = save.isPending || reset.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDocumentId(source.documentId);
          setArticle(source.article ?? "");
          setPage(source.page?.toString() ?? "");
        }
      }}
    >
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Ubah ${source.label}`} />}
      >
        <PencilIcon />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{source.label}</DialogTitle>
          <DialogDescription>
            Pilih dokumen serta pasal atau halaman yang dikutip Nemu untuk perhitungan ini.
            Dokumennya harus aktif.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (pageInvalid) return;
            save.mutate({
              key: source.key,
              documentId,
              article: article.trim() || undefined,
              page: pageNumber,
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor={`${source.key}-document`}>Dokumen</Label>
            <Select
              items={options}
              value={documentId || null}
              onValueChange={(next) => setDocumentId(next ?? "")}
            >
              <SelectTrigger id={`${source.key}-document`} className="w-full">
                <SelectValue placeholder="Pilih dokumen" />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <div className="grid gap-2">
              <Label htmlFor={`${source.key}-article`}>Pasal atau bagian</Label>
              <Input
                id={`${source.key}-article`}
                placeholder="8 ayat (5)"
                value={article}
                onChange={(event) => setArticle(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${source.key}-page`}>Halaman</Label>
              <Input
                id={`${source.key}-page`}
                inputMode="numeric"
                aria-invalid={pageInvalid}
                value={page}
                onChange={(event) => setPage(event.target.value)}
              />
            </div>
          </div>
          {pageInvalid && <p className="text-sm text-destructive">Halaman harus bilangan bulat.</p>}
          <DialogFooter>
            {!source.isDefault && (
              <Button
                type="button"
                variant="outline"
                className="sm:mr-auto"
                disabled={pending}
                onClick={() => reset.mutate({ key: source.key })}
              >
                {reset.isPending && <Spinner />}
                Pakai bawaan
              </Button>
            )}
            <DialogClose render={<Button type="button" variant="outline" />}>Batal</DialogClose>
            <Button type="submit" disabled={pending || !documentId || pageInvalid}>
              {save.isPending && <Spinner />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
