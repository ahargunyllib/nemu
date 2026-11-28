import { AppHeader } from "@nemu/ui/shell/app-header";
import { AppShell } from "@nemu/ui/shell/app-shell";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/features/auth/api/auth-client";
import UserMenu from "@/features/auth/components/user-menu";
import WorkspaceBreadcrumb from "@/features/workspace/components/workspace-breadcrumb";
import WorkspaceSidebar from "@/features/workspace/components/workspace-sidebar";
import { canOpen } from "@/features/workspace/lib/nav-items";
import { homePath } from "@/features/workspace/lib/roles";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async ({ location }) => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }
    // A school operator sees only its school's pages; anything else sends them to Ringkasan.
    const role = session.data.user.role;
    if (!canOpen(role, location.pathname)) throw redirect({ to: homePath() });
    return { session };
  },
});

function AuthLayout() {
  const { session } = Route.useRouteContext();

  return (
    <AppShell
      sidebar={<WorkspaceSidebar role={session.data?.user.role} footer={<UserMenu />} />}
      header={<AppHeader start={<WorkspaceBreadcrumb />} end={session.data?.user.email} />}
    >
      <Outlet />
    </AppShell>
  );
}
