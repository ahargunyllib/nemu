import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@nemu/ui/components/breadcrumb";
import { useRouterState } from "@tanstack/react-router";

import { findNavLocation } from "@/features/workspace/lib/nav-items";

/** Where the admin is, above the page's title: Workspace, the section, then the page. */
export default function WorkspaceBreadcrumb() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const location = findNavLocation(pathname);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>Workspace</BreadcrumbItem>
        {location && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>{location.group}</BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{location.item}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
