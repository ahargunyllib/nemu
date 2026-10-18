import { SidebarInset, SidebarProvider } from "@nemu/ui/components/sidebar";
import type { ReactNode } from "react";

type AppShellProps = {
  /** An `AppSidebar`. */
  sidebar: ReactNode;
  /** An `AppHeader`. */
  header: ReactNode;
  children: ReactNode;
};

/**
 * The signed-in layout the Demo App and the Admin Workspace share: the dark side menu, a white top
 * bar, and the page on a muted background.
 */
export function AppShell({ sidebar, header, children }: AppShellProps) {
  return (
    <SidebarProvider>
      {sidebar}
      <SidebarInset className="min-w-0 bg-muted/40">
        {header}
        {/* The page fills the width with the same `px-6` gutter as `AppHeader`, so its edges line
            up with the top bar's, and grows to the bottom so a page can fill the height. */}
        <div className="flex flex-1 flex-col gap-6 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
