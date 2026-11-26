import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import IntegrationSettings from "@/features/integrations/components/integration-settings";

export const Route = createFileRoute("/_auth/integrations")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <PageHeading
        title="Integrasi"
        description="Alamat dan kunci yang dipakai Nemu untuk membaca sistem sekolah. Semuanya disimpan terenkripsi dan tidak bisa dilihat lagi setelah disimpan."
      />
      <IntegrationSettings />
    </>
  );
}
