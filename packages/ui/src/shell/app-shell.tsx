import { SidebarInset, SidebarProvider } from "@nemu/ui/components/sidebar";
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

const contentVariants = cva("mx-auto space-y-6", {
  variants: {
    width: {
      /** Forms and dashboards. */
      default: "max-w-5xl",
      /** Pages built around a wide table. */
      wide: "max-w-6xl",
    },
  },
  defaultVariants: {
    width: "default",
  },
});

type AppShellProps = VariantProps<typeof contentVariants> & {
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
export function AppShell({ sidebar, header, width, children }: AppShellProps) {
  return (
    <SidebarProvider>
      {sidebar}
      <SidebarInset className="min-w-0 bg-muted/40">
        {header}
        <main className="p-6">
          <div className={contentVariants({ width })}>{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
