import { AppHeader } from "@nemu/ui/shell/app-header";
import { AppShell } from "@nemu/ui/shell/app-shell";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/features/auth/api/auth-client";
import UserMenu from "@/features/auth/components/user-menu";
import DemoDock from "@/features/demo/components/demo-dock";
import SideMenu from "@/features/menu/components/side-menu";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }
    return { user: session.data.user };
  },
});

function AuthLayout() {
  const { user } = Route.useRouteContext();

  return (
    <DemoDock>
      <AppShell
        sidebar={<SideMenu footer={<UserMenu />} />}
        header={<AppHeader start="Satker Demo · Yogyakarta" end={user.email} />}
      >
        <Outlet />
      </AppShell>
    </DemoDock>
  );
}
