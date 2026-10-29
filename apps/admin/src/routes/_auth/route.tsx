import { AppHeader } from "@nemu/ui/shell/app-header";
import { AppShell } from "@nemu/ui/shell/app-shell";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/features/auth/api/auth-client";
import UserMenu from "@/features/auth/components/user-menu";
import WorkspaceBreadcrumb from "@/features/workspace/components/workspace-breadcrumb";
import WorkspaceSidebar from "@/features/workspace/components/workspace-sidebar";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }
    return { session };
  },
});

function AuthLayout() {
  const { session } = Route.useRouteContext();

  return (
    <AppShell
      sidebar={<WorkspaceSidebar footer={<UserMenu />} />}
      header={<AppHeader start={<WorkspaceBreadcrumb />} end={session.data?.user.email} />}
    >
      <Outlet />
    </AppShell>
  );
}
