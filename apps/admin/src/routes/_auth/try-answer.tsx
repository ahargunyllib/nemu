import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import TryAnswerPanel from "@/features/try-answer/components/try-answer-panel";

export const Route = createFileRoute("/_auth/try-answer")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <PageHeading
        title="Uji jawaban"
        description="Lihat jawaban dan sumber Nemu dari dokumen yang belum aktif, sebelum guru memakainya."
      />
      <TryAnswerPanel />
    </>
  );
}
