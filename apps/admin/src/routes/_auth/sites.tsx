import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import SiteList from "@/features/sites/components/site-list";

export const Route = createFileRoute("/_auth/sites")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <PageHeading
        title="Situs yang diizinkan"
        description="Di mana tombol Nemu muncul, dan apa yang boleh dilakukan Nemu di tiap situs. Ekstensi mengikutinya tanpa pembaruan."
      />
      <SiteList />
    </>
  );
}
