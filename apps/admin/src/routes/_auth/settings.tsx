import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import SchoolSettingsForm from "@/features/settings/components/school-settings-form";

export const Route = createFileRoute("/_auth/settings")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <PageHeading
        title="Pengaturan Nemu"
        description="Tombol bicara, cara bawaan, dan kecepatan mengisi untuk semua guru sekolah ini."
      />
      <SchoolSettingsForm />
    </>
  );
}
