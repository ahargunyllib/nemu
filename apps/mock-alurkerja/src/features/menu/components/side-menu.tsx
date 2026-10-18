import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@nemu/ui/components/sidebar";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { MENU_ITEMS } from "@/features/menu/lib/menu-items";
import { orpc } from "@/shared/api/orpc";

/** AlurKerja's dark side menu: Start a Process, the menus, and the signed-in user at the bottom. */
export default function SideMenu({ footer }: { footer: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: tasks } = useQuery(orpc.listMyTasks.queryOptions());

  return (
    // `dark` switches the sidebar tokens to their dark values, so the menu stays on theme tokens.
    <Sidebar collapsible="none" aria-label="Menu utama" className="dark sticky top-0 h-svh">
      <SidebarHeader className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              variant="outline"
              className="rounded-full font-medium"
              data-nemu-id={NEMU_IDS.shell.menuAjukanPerjalananDinas}
              render={<Link to="/perdin/baru" />}
            >
              <span aria-hidden className="size-2 rounded-full bg-sidebar-primary" />
              <span>Start a Process</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {MENU_ITEMS.map(({ label, icon: Icon, link, badge }) => (
              <SidebarMenuItem key={label}>
                {link ? (
                  <SidebarMenuButton
                    isActive={link.to === "/" ? pathname === "/" : pathname.startsWith(link.to)}
                    data-nemu-id={link.nemuId}
                    render={<Link to={link.to} />}
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton disabled>
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                )}
                {badge !== undefined && (
                  <SidebarMenuBadge>{badge === "tasks" ? tasks?.length : badge}</SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* Bottom room for the demo dock, which floats over the end of the side menu. */}
      <SidebarFooter className="pb-24">{footer}</SidebarFooter>
    </Sidebar>
  );
}
