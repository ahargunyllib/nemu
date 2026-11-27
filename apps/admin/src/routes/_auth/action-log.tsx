import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import ActionLogTable from "@/features/action-log/components/action-log-table";

export const Route = createFileRoute("/_auth/action-log")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <PageHeading
        title="Log tindakan"
        description="Apa yang dilakukan Nemu di halaman guru. Tombol Simpan dan Kirim selalu ditekan guru sendiri."
      />
      <ActionLogTable />
    </>
  );
}
