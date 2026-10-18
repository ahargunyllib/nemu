import { Avatar, AvatarFallback } from "@nemu/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@nemu/ui/components/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@nemu/ui/components/sidebar";
import { Skeleton } from "@nemu/ui/components/skeleton";
import type { ComponentProps, ReactNode } from "react";

type AccountMenuProps = Omit<ComponentProps<typeof DropdownMenuTrigger>, "render" | "children"> & {
  name: string;
  /** The line under the name, such as a job title or an email. */
  detail: ReactNode;
  /** The menu's items. */
  children: ReactNode;
};

/** The signed-in user at the bottom of an `AppSidebar`; it opens the account menu. */
export function AccountMenu({ name, detail, children, ...triggerProps }: AccountMenuProps) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />} {...triggerProps}>
            <Avatar className="size-8">
              <AvatarFallback>{initials(name)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left leading-tight">
              <span className="truncate font-medium">{name}</span>
              <span className="truncate text-xs text-sidebar-foreground/70">{detail}</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56 bg-card" side="right" align="end">
            {children}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/** Stands in for `AccountMenu` while the session loads. */
export function AccountMenuSkeleton() {
  return (
    <div className="flex items-center gap-2 p-2">
      <Skeleton className="size-8 rounded-full" />
      <div className="grid flex-1 gap-1">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
