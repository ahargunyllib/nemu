import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@nemu/ui/components/sidebar";
import { AppSidebar } from "@nemu/ui/shell/app-sidebar";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";

import { MENU_ITEMS, claimInFocus, telcoMenuItems } from "@/features/menu/lib/menu-items";
import { orpc } from "@/shared/api/orpc";

/**
 * AlurKerja's dark side menu: Mulai Proses, the menus, and the signed-in user at the bottom.
 * The W-TELKO workspace gets its SLA-claim menus instead.
 */
export default function SideMenu({
  footer,
  workspaceId,
}: {
  footer: ReactNode;
  workspaceId?: string | null;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isTelco = workspaceId === "W-TELKO";
  const { data: tasks } = useQuery(orpc.listMyTasks.queryOptions({ enabled: !isTelco }));
  const { data: claims } = useQuery(
    orpc.listSlaClaims.queryOptions({ input: { workspaceId: "W-TELKO" }, enabled: isTelco }),
  );

  if (isTelco) {
    return (
      <AppSidebar aria-label="Menu utama">
        <SidebarContent>
          <SidebarGroup className="px-3 pt-4.5 pb-0">
            <SidebarMenu className="gap-0.75">
              {telcoMenuItems(claims && claimInFocus(claims, pathname)).map(
                ({ label, section, nemuId, link }) => (
                  <SidebarMenuItem key={label}>
                    {link ? (
                      <SidebarMenuButton
                        className="px-2.5"
                        isActive={section === "/" ? pathname === "/" : pathname.startsWith(section)}
                        data-nemu-id={nemuId}
                        render={<Link {...link} />}
                      >
                        <span className="flex-1 truncate">{label}</span>
                      </SidebarMenuButton>
                    ) : (
                      // No claim to open records for yet.
                      <SidebarMenuButton className="px-2.5" disabled>
                        <span className="flex-1 truncate">{label}</span>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                ),
              )}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="px-3 pb-24">{footer}</SidebarFooter>
      </AppSidebar>
    );
  }

  return (
    <AppSidebar aria-label="Menu utama">
      <SidebarHeader className="px-3 pt-4.5 pb-0">
        <SidebarMenu>
          <SidebarMenuItem>
            {/* A blue-green-amber gradient ring: the gradient fills the pill, the inner span covers
                all but its 1.5px edge. */}
            <SidebarMenuButton
              className="h-auto rounded-full bg-linear-to-r from-blue-500 via-emerald-500 to-amber-400 p-[1.5px] font-medium text-sidebar-foreground"
              data-nemu-id={NEMU_IDS.shell.menuAjukanPerjalananDinas}
              render={<Link to="/perdin/baru" />}
            >
              <span className="flex flex-1 items-center gap-2.5 rounded-full bg-sidebar py-2 pr-3.5 pl-2 transition-colors group-hover/menu-button:bg-sidebar-accent">
                <span
                  aria-hidden
                  className="size-7 shrink-0 rounded-full bg-linear-to-br from-indigo-500 to-sky-400"
                />
                <span className="truncate">Mulai Proses</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-3 pt-3.5 pb-0">
          <SidebarMenu className="gap-0.75">
            {MENU_ITEMS.map(({ label, link, badge, submenu }) => {
              const count = badge === "tasks" ? tasks?.length : badge;
              const content = (
                <>
                  <span className="flex-1 truncate">{label}</span>
                  {submenu && <ChevronRightIcon className="text-sidebar-foreground/45" />}
                </>
              );

              return (
                <SidebarMenuItem key={label}>
                  {link ? (
                    <SidebarMenuButton
                      className="px-2.5"
                      isActive={link.to === "/" ? pathname === "/" : pathname.startsWith(link.to)}
                      data-nemu-id={link.nemuId}
                      render={<Link to={link.to} />}
                    >
                      {content}
                    </SidebarMenuButton>
                  ) : (
                    // AlurKerja shows these menus at full strength; the demo just has no page.
                    <SidebarMenuButton className="px-2.5 disabled:opacity-100" disabled>
                      {content}
                    </SidebarMenuButton>
                  )}
                  {!!count && (
                    <SidebarMenuBadge className="right-2.5 h-4 min-w-5 rounded-full bg-red-600 px-1.5 text-[11.5px] font-normal text-white peer-hover/menu-button:text-white peer-data-active/menu-button:text-white peer-data-[size=default]/menu-button:top-2.5">
                      {count}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* Bottom room for the demo dock, which floats over the end of the side menu. */}
      <SidebarFooter className="px-3 pb-24">{footer}</SidebarFooter>
    </AppSidebar>
  );
}
