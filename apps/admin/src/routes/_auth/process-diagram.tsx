import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import ProcessDiagram from "@/features/process-diagram/components/process-diagram";

/** "Lihat diagram" from Nemu's answer (F2-08): `element` is the cause, `path` the steps' elements. */
const searchSchema = z.object({
  document: z.string().min(1),
  element: z.string().optional(),
  path: z.string().optional(),
});

export const Route = createFileRoute("/_auth/process-diagram")({
  validateSearch: searchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const { document, element, path } = Route.useSearch();
  return (
    <>
      <PageHeading
        title="Diagram proses"
        description="Proses BPMN yang diunggah sekolah. Langkah yang dijelaskan Nemu ditandai; penyebabnya berwarna merah."
      />
      <ProcessDiagram
        documentId={document}
        elementId={element ?? null}
        pathIds={path ? path.split(",").filter(Boolean) : []}
      />
    </>
  );
}
