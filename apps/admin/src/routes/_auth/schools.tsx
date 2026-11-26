import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import SchoolList from "@/features/school/components/school-list";

export const Route = createFileRoute("/_auth/schools")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <PageHeading
        title="Daftar sekolah"
        description="Sekolah yang dilayani Nemu. Operator setiap sekolah hanya melihat sekolahnya sendiri."
      />
      <SchoolList />
    </>
  );
}
