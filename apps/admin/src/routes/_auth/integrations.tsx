import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import IntegrationSettings from "@/features/integrations/components/integration-settings";
import { isFullAdmin } from "@/features/workspace/lib/roles";

export const Route = createFileRoute("/_auth/integrations")({
  component: RouteComponent,
});

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const canEdit = isFullAdmin(session.data?.user.role);

  return (
    <>
      <PageHeading
        title="Integrasi"
        description={
          canEdit
            ? "Alamat dan kunci yang dipakai Nemu untuk membaca sistem sekolah. Semuanya disimpan terenkripsi dan tidak bisa dilihat lagi setelah disimpan."
            : "Diisi Admin Javan. Kunci disimpan terenkripsi di server dan tidak bisa ditampilkan lagi setelah disimpan."
        }
      />
      <IntegrationSettings canEdit={canEdit} />
    </>
  );
}
