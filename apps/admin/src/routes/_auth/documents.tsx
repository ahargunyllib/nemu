import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import DocumentList from "@/features/documents/components/document-list";
import DocumentUploadDialog from "@/features/documents/components/document-upload-dialog";

export const Route = createFileRoute("/_auth/documents")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <PageHeading
        title="Documents"
        description="Knowledge documents Nemu answers from. Only active, ready documents are used."

        actions={<DocumentUploadDialog />}
      />
      <DocumentList />
    </>
  );
}
