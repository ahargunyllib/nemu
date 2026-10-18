import type { AppRouterClient } from "@nemu/api/routers/index";
import { Toaster } from "@nemu/ui/components/sonner";
import { createORPCClient } from "@orpc/client";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { HeadContent, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useState } from "react";

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
        title: "Alur Kerja Demo",
      },
      {
        name: "description",
        content: "Demo workflow app for the Nemu guide",
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
      <ThemeProvider attribute="class" forcedTheme="light" disableTransitionOnChange>
        <Outlet />
        <Toaster richColors position="top-center" />
      </ThemeProvider>
      {/* Top right: Start a Process is at the top left and the demo dock at the bottom left. */}
      <TanStackRouterDevtools position="top-right" />
      <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
    </>
  );
}
