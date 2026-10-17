import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@nemu/ui/components/breadcrumb";
import { Separator } from "@nemu/ui/components/separator";
import { SidebarTrigger } from "@nemu/ui/components/sidebar";
import { useRouterState } from "@tanstack/react-router";

import { findNavLocation } from "@/features/workspace/lib/nav-items";

export default function WorkspaceHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const location = findNavLocation(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
      {location && (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">{location.group}</BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>{location.item}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )}
    </header>
  );
}
