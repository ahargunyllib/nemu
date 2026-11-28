import { SidebarInset, SidebarProvider } from "@nemu/ui/components/sidebar";
import type { ReactNode } from "react";

type AppShellProps = {
  /** An `AppSidebar`. */
  sidebar: ReactNode;
  /** An `AppHeader`. */
  header: ReactNode;
  /** Where the page sits in the menu, shown just above the page's title. */
  breadcrumb?: ReactNode;
  children: ReactNode;
};

/**
 * The signed-in layout the Demo App and the Admin Workspace share: the dark side menu, a white top
 * bar, and the page on a muted background.
 */
export function AppShell({ sidebar, header, breadcrumb, children }: AppShellProps) {
  return (
    <SidebarProvider>
      {sidebar}
      <SidebarInset className="min-w-0 bg-muted/40">
        {header}
        {/* The page fills the width with the same `px-6` gutter as `AppHeader`, so its edges line
            up with the top bar's, and grows to the bottom so a page can fill the height. */}
        <div className="flex flex-1 flex-col gap-6 p-6">
          {/* The breadcrumb hugs the title under it: the negative margin takes back most of the gap. */}
          {breadcrumb && <div className="-mb-5">{breadcrumb}</div>}
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
