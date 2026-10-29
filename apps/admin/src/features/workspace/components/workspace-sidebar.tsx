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

import { NAV_GROUPS } from "@/features/workspace/lib/nav-items";

/** The Admin Workspace's dark side menu: the workspace, its sections, and the admin at the bottom. */
export default function WorkspaceSidebar({ footer }: { footer: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <AppSidebar aria-label="Admin menu">
      <SidebarHeader className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/dashboard" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
                <SparklesIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-semibold">Nemu</span>
                <span className="truncate text-xs text-sidebar-foreground/70">Admin Workspace</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
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
