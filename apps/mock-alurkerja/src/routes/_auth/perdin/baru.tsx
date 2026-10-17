import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@nemu/ui/components/empty";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/perdin/baru")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <h1 className="text-lg font-semibold">Ajukan Perjalanan Dinas</h1>
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Formulir pengajuan</EmptyTitle>
          <EmptyDescription>
            Formulir Perjalanan Dinas akan tersedia di halaman ini.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </>
  );
}
