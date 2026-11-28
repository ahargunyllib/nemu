import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import IntegrationSummary from "@/features/integrations/components/integration-summary";
import SchoolSettingsSummary from "@/features/settings/components/settings-summary";
import SiteDialog from "@/features/sites/components/site-dialog";
import SiteList from "@/features/sites/components/site-list";
import { isFullAdmin } from "@/features/workspace/lib/roles";

export const Route = createFileRoute("/_auth/sites")({
  component: RouteComponent,
});

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const user = session.data?.user;
  // WS-07 and WS-08 are Admin Javan's; an operator sees only the website list.
  const showSummary = isFullAdmin(user?.role);

  return (
    <>
      <PageHeading title="Website diizinkan" actions={<SiteDialog />} />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <SiteList />
        {showSummary && (
          <div className="grid gap-4">
            <IntegrationSummary />
            <SchoolSettingsSummary workspaceId={user?.workspaceId ?? undefined} />
          </div>
        )}
      </div>
    </>
  );
}
