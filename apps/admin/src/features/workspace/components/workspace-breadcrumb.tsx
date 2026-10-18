import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@nemu/ui/components/breadcrumb";
import { useRouterState } from "@tanstack/react-router";

import { findNavLocation } from "@/features/workspace/lib/nav-items";

/** Where the admin is, for the top bar: the section, then the page. */
export default function WorkspaceBreadcrumb() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const location = findNavLocation(pathname);

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem className="hidden xl:inline-flex">Admin Workspace</BreadcrumbItem>
        {location && (
          <>
            <BreadcrumbSeparator className="hidden xl:inline-flex" />
            <BreadcrumbItem className="hidden md:inline-flex">{location.group}</BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:inline-flex" />
            <BreadcrumbItem>
              <BreadcrumbPage>{location.item}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
