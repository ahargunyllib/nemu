import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import KamusDialog from "@/features/kamus/components/kamus-dialog";
import KamusImportDialog from "@/features/kamus/components/kamus-import-dialog";
import KamusList from "@/features/kamus/components/kamus-list";

export const Route = createFileRoute("/_auth/kamus")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <PageHeading
        title="Kamus kendala"
        actions={
          <>
            <KamusImportDialog />
            <KamusDialog />
          </>
        }
      />
      <KamusList />
    </>
  );
}
