import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import DocumentList from "@/features/documents/components/document-list";
import DocumentUploadDialog from "@/features/documents/components/document-upload-dialog";
import RuleSourceList from "@/features/rule-sources/components/rule-source-list";

/** `cari`: a document picked in the top bar's search, shown filtered in the list. */
const searchSchema = z.object({
  cari: z.string().optional(),
});

export const Route = createFileRoute("/_auth/documents")({
  validateSearch: searchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const { cari } = Route.useSearch();
  return (
    <>
      <PageHeading
        title="Dokumen dan alur"
        description="SOP, proses BPMN, dan rekaman yang menjadi sumber jawaban Nemu. Hanya dokumen aktif dan siap yang dipakai."
        actions={<DocumentUploadDialog />}
      />
      {/* Keyed by the search, so picking another document in the top bar refills the box. */}
      <DocumentList key={cari} title="Dokumen sekolah" initialQuery={cari} />
      <RuleSourceList />
    </>
  );
}
