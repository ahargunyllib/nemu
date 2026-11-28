import { AppHeader } from "@nemu/ui/shell/app-header";
import { AppShell } from "@nemu/ui/shell/app-shell";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/features/auth/api/auth-client";
import UserMenu from "@/features/auth/components/user-menu";
import SchoolCard from "@/features/school/components/school-card";
import SchoolSwitcher from "@/features/school/components/school-switcher";
import WorkspaceBreadcrumb from "@/features/workspace/components/workspace-breadcrumb";
import WorkspaceSearch from "@/features/workspace/components/workspace-search";
import WorkspaceSidebar from "@/features/workspace/components/workspace-sidebar";
import { canOpen } from "@/features/workspace/lib/nav-items";
import { homePath, isFullAdmin } from "@/features/workspace/lib/roles";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async ({ location }) => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }
    // A school operator sees only its school's pages; anything else sends them to WS-06.
    const role = session.data.user.role;
    if (!canOpen(role, location.pathname)) throw redirect({ to: homePath(role) });
    return { session };
  },
});

function AuthLayout() {
  const { session } = Route.useRouteContext();
  const role = session.data?.user.role;

  return (
    <AppShell
      sidebar={<WorkspaceSidebar role={role} footer={<SchoolCard />} />}
      header={
        <AppHeader
          start={<WorkspaceSearch />}
          end={
            <>
              <SchoolSwitcher fullAdmin={isFullAdmin(role)} />
              <UserMenu />
            </>
          }
        />
      }
      breadcrumb={<WorkspaceBreadcrumb />}
    >
      <Outlet />
    </AppShell>
  );
}
