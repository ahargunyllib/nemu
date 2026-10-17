import { createFileRoute } from "@tanstack/react-router";

import ReferenceTableList from "@/features/reference-tables/components/reference-table-list";
import ReferenceTableUploadDialog from "@/features/reference-tables/components/reference-table-upload-dialog";
import PageHeader from "@/shared/components/page-header";

export const Route = createFileRoute("/_auth/tables")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <PageHeader
        title="Tables"
        description="SBM 2026 and holiday calendar tables. Nemu still answers from its bundled snapshot, so uploads don't change answers yet."
      >
        <ReferenceTableUploadDialog />
      </PageHeader>
      <ReferenceTableList />
    </>
  );
}
