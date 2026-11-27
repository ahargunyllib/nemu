import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import KamusList from "@/features/kamus/components/kamus-list";

export const Route = createFileRoute("/_auth/kamus")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <PageHeading
        title="Kamus Kendala"
        description='Saat guru bertanya "ini kenapa?", Nemu menjawab hanya dari kamus ini.'
      />
      <KamusList />
    </>
  );
}
