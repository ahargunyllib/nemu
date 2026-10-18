import { Sidebar } from "@nemu/ui/components/sidebar";
import { cn } from "cn";
import type { ComponentProps } from "react";

/** The dark side menu of `AppShell`; compose `SidebarHeader`, `SidebarContent` and `SidebarFooter` in it. */
export function AppSidebar({ className, ...props }: ComponentProps<typeof Sidebar>) {
  return (
    // `dark` switches the sidebar tokens to their dark values, so the menu stays on theme tokens.
    <Sidebar
      collapsible="none"
      className={cn("dark sticky top-0 h-svh shrink-0", className)}
      {...props}
    />
  );
}
