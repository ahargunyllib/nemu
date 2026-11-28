import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import SiteDialog from "@/features/sites/components/site-dialog";
import SiteList from "@/features/sites/components/site-list";

export const Route = createFileRoute("/_auth/sites")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <PageHeading title="Website diizinkan" actions={<SiteDialog />} />
      <SiteList />
    </>
  );
}
