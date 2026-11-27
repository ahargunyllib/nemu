import { Button } from "@nemu/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@nemu/ui/components/dialog";
import { CopyPlusIcon, UploadIcon } from "lucide-react";
import { useState } from "react";

import type { DocumentScope } from "@/features/documents/api/list-documents";
import DocumentUploadForm from "@/features/documents/components/document-upload-form";

/**
 * Uploads knowledge into the school's own list or the AlurSekolah package. With `nextVersionOf`,
 * it uploads the next version of that title, inactive until it has been tried.
 */
export default function DocumentUploadDialog({
  packageId = null,
  nextVersionOf,
}: {
  packageId?: DocumentScope;
  nextVersionOf?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {nextVersionOf ? (
        <DialogTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`Versi baru ${nextVersionOf}`} />
          }
        >
          <CopyPlusIcon />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <UploadIcon />
          Unggah dokumen
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {nextVersionOf ? `Versi baru: ${nextVersionOf}` : "Unggah dokumen"}
          </DialogTitle>
          <DialogDescription>
            PDF, Markdown, atau BPMN. Nemu hanya menjawab dari dokumen aktif; coba dulu di Uji
            jawaban sebelum mengaktifkan. PDF hasil pindai tanpa lapisan teks tidak bisa dibaca.
          </DialogDescription>
        </DialogHeader>
        <DocumentUploadForm
          packageId={packageId}
          initialTitle={nextVersionOf}
          onUploaded={() => setOpen(false)}
        >
          <DialogClose render={<Button type="button" variant="outline" />}>Batal</DialogClose>
        </DocumentUploadForm>
      </DialogContent>
    </Dialog>
  );
}
