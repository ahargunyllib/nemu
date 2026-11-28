import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import DocumentList from "@/features/documents/components/document-list";
import DocumentUploadDialog from "@/features/documents/components/document-upload-dialog";
import KnowledgeStats from "@/features/documents/components/knowledge-stats";
import RecordProcedureDialog from "@/features/documents/components/record-procedure-dialog";
import RuleSourceList from "@/features/rule-sources/components/rule-source-list";

export const Route = createFileRoute("/_auth/documents")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <PageHeading
        title="Dokumen dan alur"
        actions={
          <>
            <DocumentUploadDialog kind="pdf" variant="outline" />
            <DocumentUploadDialog kind="bpmn" variant="outline" />
            <RecordProcedureDialog />
          </>
        }
      />
      <KnowledgeStats />
      <DocumentList title="Dokumen sekolah" />
      <RuleSourceList />
    </>
  );
}
