import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/features/auth/api/auth-client";
import UserMenu from "@/features/auth/components/user-menu";
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
  return (
    <div className="grid h-svh grid-rows-[auto_1fr]">
      <Header>
        <UserMenu />
      </Header>
      <div className="grid min-h-0 grid-cols-[14rem_1fr]">
        <SideMenu />
        <main className="overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
