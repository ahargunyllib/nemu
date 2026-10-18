import { SidebarInset, SidebarProvider } from "@nemu/ui/components/sidebar";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/features/auth/api/auth-client";
import UserMenu from "@/features/auth/components/user-menu";
import DemoDock from "@/features/demo/components/demo-dock";
import SideMenu from "@/features/menu/components/side-menu";
import Header from "@/shared/components/header";

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
      <SidebarProvider>
        <SideMenu footer={<UserMenu />} />
        <SidebarInset className="bg-muted/40">
          <Header>{user.email}</Header>
          <main className="p-6">
            <div className="mx-auto max-w-5xl space-y-6">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </DemoDock>
  );
}
