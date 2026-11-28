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
import { UPLOAD_KINDS, type UploadKind } from "@/features/documents/lib/upload-kinds";

/**
 * Uploads knowledge into the school's own list or the AlurSekolah package; `kind` limits it to
 * PDFs or BPMN ("Unggah PDF", "Unggah BPMN"). With `nextVersionOf`, it uploads the next version of
 * that title, inactive until it has been tried.
 */
export default function DocumentUploadDialog({
  packageId = null,
  kind = "any",
  variant = "default",
  nextVersionOf,
}: {
  packageId?: DocumentScope;
  kind?: UploadKind;
  variant?: "default" | "outline";
  nextVersionOf?: string;
}) {
  const [open, setOpen] = useState(false);
  const files = UPLOAD_KINDS[kind];

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
        <DialogTrigger render={<Button variant={variant} />}>
          <UploadIcon />
          {files.label}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{nextVersionOf ? `Versi baru: ${nextVersionOf}` : files.label}</DialogTitle>
          <DialogDescription>{files.description}</DialogDescription>
        </DialogHeader>
        <DocumentUploadForm
          packageId={packageId}
          kind={kind}
          initialTitle={nextVersionOf}
          onUploaded={() => setOpen(false)}
        >
          <DialogClose render={<Button type="button" variant="outline" />}>Batal</DialogClose>
        </DocumentUploadForm>
      </DialogContent>
    </Dialog>
  );
}
