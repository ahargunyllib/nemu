import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import ReferenceTableList from "@/features/reference-tables/components/reference-table-list";
import ReferenceTableUploadDialog from "@/features/reference-tables/components/reference-table-upload-dialog";

export const Route = createFileRoute("/_auth/tables")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <PageHeading
        title="Tables"
        description="SBM 2026 and holiday calendar tables. Nemu still answers from its bundled snapshot, so uploads don't change answers yet."

        actions={<ReferenceTableUploadDialog />}
      />
      <ReferenceTableList />
    </>
  );
}
