import { createFileRoute } from "@tanstack/react-router";

import DocumentList from "@/features/documents/components/document-list";
import DocumentUploadForm from "@/features/documents/components/document-upload-form";

export const Route = createFileRoute("/_auth/documents")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="container mx-auto grid max-w-5xl content-start gap-6 px-4 py-6">
      <DocumentUploadForm />
      <DocumentList />
    </div>
  );
}
