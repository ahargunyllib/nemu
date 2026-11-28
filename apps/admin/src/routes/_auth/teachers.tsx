import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import ContactList from "@/features/school/components/contact-list";
import TeacherList from "@/features/school/components/teacher-list";

export const Route = createFileRoute("/_auth/teachers")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <PageHeading
        title="Guru dan kontak"
        description="Guru yang dikenali Nemu dan siapa yang dihubungi untuk kendala di luar tugas guru."
      />
      <TeacherList />
      <ContactList />
    </>
  );
}
