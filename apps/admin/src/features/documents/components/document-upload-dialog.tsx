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
import { UploadIcon } from "lucide-react";
import { useState } from "react";

import DocumentUploadForm from "@/features/documents/components/document-upload-form";

export default function DocumentUploadDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <UploadIcon />
        Upload document
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>
            Add a knowledge document as PDF or Markdown. Nemu answers only from active documents.
          </DialogDescription>
        </DialogHeader>
        <DocumentUploadForm onUploaded={() => setOpen(false)}>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        </DocumentUploadForm>
      </DialogContent>
    </Dialog>
  );
}
