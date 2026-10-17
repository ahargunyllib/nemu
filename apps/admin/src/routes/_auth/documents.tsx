import { createFileRoute } from "@tanstack/react-router";

import DocumentList from "@/features/documents/components/document-list";
import DocumentUploadDialog from "@/features/documents/components/document-upload-dialog";
import PageHeader from "@/shared/components/page-header";

export const Route = createFileRoute("/_auth/documents")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <PageHeader
        title="Documents"
        description="Knowledge documents Nemu answers from. Only active, ready documents are used."
      >
        <DocumentUploadDialog />
      </PageHeader>
      <DocumentList />
    </>
  );
}
