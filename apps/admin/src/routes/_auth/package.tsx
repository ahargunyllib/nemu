import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import DocumentList from "@/features/documents/components/document-list";
import DocumentUploadDialog from "@/features/documents/components/document-upload-dialog";
import PackageScopeCard from "@/features/package/components/package-scope-card";

export const Route = createFileRoute("/_auth/package")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <PageHeading
        title="Paket AlurSekolah"
        description="Pengetahuan bawaan yang sama untuk sekolah pengguna AlurSekolah."
        actions={<DocumentUploadDialog packageId="alursekolah" />}
      />
      <PackageScopeCard />
      <DocumentList packageId="alursekolah" title="Dokumen paket" />
    </>
  );
}
