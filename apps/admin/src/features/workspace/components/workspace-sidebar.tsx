import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@nemu/ui/components/sidebar";
import { AppSidebar } from "@nemu/ui/shell/app-sidebar";
import { Link, useRouterState } from "@tanstack/react-router";
import { SparklesIcon } from "lucide-react";
import type { ReactNode } from "react";

import { navGroupsFor } from "@/features/workspace/lib/nav-items";
import { homePath } from "@/features/workspace/lib/roles";

/** The Admin Workspace's dark side menu: the sections the admin's role sees, and the admin at the bottom. */
export default function WorkspaceSidebar({
  role,
  footer,
}: {
  role: string | null | undefined;
  footer: ReactNode;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <AppSidebar aria-label="Admin menu">
      <SidebarHeader className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to={homePath(role)} />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
                <SparklesIcon className="size-4" />
              </div>
              <span className="flex-1 truncate text-left">
                <span className="font-semibold">Nemu</span>{" "}
                <span className="text-sidebar-foreground/70">Workspace</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroupsFor(role).map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map(({ to, label, icon: Icon }) => (
                <SidebarMenuItem key={label}>
                  {to ? (
                    <SidebarMenuButton isActive={pathname.startsWith(to)} render={<Link to={to} />}>
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  ) : (
                    <>
                      <SidebarMenuButton disabled>
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                      <SidebarMenuBadge>Soon</SidebarMenuBadge>
                    </>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>{footer}</SidebarFooter>
    </AppSidebar>
  );
}
