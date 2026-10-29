import { AppHeader } from "@nemu/ui/shell/app-header";
import { AppShell } from "@nemu/ui/shell/app-shell";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { ensureSession } from "@/features/auth/api/session";
import UserMenu from "@/features/auth/components/user-menu";
import DemoDock from "@/features/demo/components/demo-dock";
import SideMenu from "@/features/menu/components/side-menu";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async ({ context }) => {
    const session = await ensureSession(context.queryClient);
    if (!session) {
      throw redirect({
        to: "/login",
      });
    }
    return { user: session.user };
  },
});

function AuthLayout() {
  const { user } = Route.useRouteContext();

  return (
    <DemoDock workspaceId={user.workspaceId}>
      <AppShell
        sidebar={<SideMenu footer={<UserMenu />} workspaceId={user.workspaceId} />}
        header={
          <AppHeader
            start={
              user.workspaceId === "W-TELKO" ? "Billing Operations" : "Satker Demo · Yogyakarta"
            }
            end={user.email}
          />
        }
      >
        <Outlet />
      </AppShell>
    </DemoDock>
  );
}
