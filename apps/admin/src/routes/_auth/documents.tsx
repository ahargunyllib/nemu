import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import DocumentList from "@/features/documents/components/document-list";
import DocumentUploadDialog from "@/features/documents/components/document-upload-dialog";
import RuleSourceList from "@/features/rule-sources/components/rule-source-list";

export const Route = createFileRoute("/_auth/documents")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <PageHeading
        title="Dokumen dan alur"
        description="SOP, proses BPMN, dan rekaman yang menjadi sumber jawaban Nemu. Hanya dokumen aktif dan siap yang dipakai."
        actions={<DocumentUploadDialog />}
      />
      <DocumentList title="Dokumen sekolah" />
      <RuleSourceList />
    </>
  );
}
