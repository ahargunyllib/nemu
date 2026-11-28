import { Avatar, AvatarFallback } from "@nemu/ui/components/avatar";
import { Button } from "@nemu/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@nemu/ui/components/dropdown-menu";
import { Skeleton } from "@nemu/ui/components/skeleton";
import type { ComponentProps, ReactNode } from "react";

type AccountMenuProps = Omit<ComponentProps<typeof DropdownMenuTrigger>, "render" | "children"> & {
  name: string;
  /** The line under the name, such as a role or a job title. */
  detail: ReactNode;
  /** The menu's items. */
  children: ReactNode;
};

/** The signed-in user at the right end of an `AppHeader`; it opens the account menu. */
export function AccountMenu({ name, detail, children, ...triggerProps }: AccountMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="h-auto gap-2.5 py-1 pr-3 pl-1" />}
        {...triggerProps}
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-orange-100 text-[13px] font-semibold text-orange-900">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden text-left sm:grid">
          <span className="truncate text-[13px] leading-4.5 font-semibold">{name}</span>
          <span className="truncate text-xs leading-4 font-normal text-muted-foreground">
            {detail}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56" align="end">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Stands in for `AccountMenu` while the session loads. */
export function AccountMenuSkeleton() {
  return (
    <div className="flex items-center gap-2.5 py-1 pr-3 pl-1">
      <Skeleton className="size-8 rounded-full" />
      <div className="hidden gap-1 sm:grid">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3 w-24" />
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
