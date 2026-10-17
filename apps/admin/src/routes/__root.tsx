import type { AppRouterClient } from "@nemu/api/routers/index";
import { Toaster } from "@nemu/ui/components/sonner";
import { createORPCClient } from "@orpc/client";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { HeadContent, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useState } from "react";

import UserMenu from "@/features/auth/components/user-menu";
import Header from "@/shared/components/header";
import { ModeToggle } from "@/shared/components/mode-toggle";
import { ThemeProvider } from "@/shared/components/theme-provider";
import { link, orpc } from "@/shared/api/orpc";

import "../index.css";

export interface RouterAppContext {
  orpc: typeof orpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [
      {
        title: "Nemu Admin Workspace",
      },
      {
        name: "description",
        content: "Manage documents, tables, domains, action rules and user profiles",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),
});

function RootComponent() {
  const [client] = useState<AppRouterClient>(() => createORPCClient(link));
  const [orpcUtils] = useState(() => createTanstackQueryUtils(client));

  return (
    <>
      <HeadContent />
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        disableTransitionOnChange
        storageKey="nemu-admin-theme"
      >
        <div className="grid grid-rows-[auto_1fr] h-svh">
          <Header>
            <ModeToggle />
            <UserMenu />
          </Header>
          <Outlet />
        </div>
        <Toaster richColors />
      </ThemeProvider>
      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
    </>
  );
}
