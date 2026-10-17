import { SidebarInset, SidebarProvider } from "@nemu/ui/components/sidebar";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/features/auth/api/auth-client";
import UserMenu from "@/features/auth/components/user-menu";
import WorkspaceHeader from "@/features/workspace/components/workspace-header";
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
  return (
    <SidebarProvider>
      <WorkspaceSidebar footer={<UserMenu />} />
      <SidebarInset>
        <WorkspaceHeader />
        <main className="mx-auto grid w-full max-w-6xl content-start gap-6 p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
