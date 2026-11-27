import { Alert, AlertDescription, AlertTitle } from "@nemu/ui/components/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";

import { client, orpc } from "@/shared/api/orpc";

import { useBpmnViewer } from "../hooks/use-bpmn-viewer";

/**
 * The school's uploaded BPMN, drawn with bpmn-js for operators (F2-08 "Lihat diagram"). The element
 * a teacher's symptom belongs to is outlined in the destructive color; the other steps Nemu named
 * in Sumber are outlined in the primary color.
 */
export default function ProcessDiagram({
  documentId,
  elementId,
  pathIds,
}: {
  documentId: string;
  elementId: string | null;
  pathIds: string[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const documents = useQuery(orpc.listDocuments.queryOptions({ input: { packageId: null } }));
  const xml = useQuery({
    queryKey: ["process-diagram", documentId],
    queryFn: async () => (await client.getDocumentFile({ id: documentId })).text(),
  });
  const error = useBpmnViewer(container, xml.data, elementId, pathIds);
  const document = documents.data?.find((item) => item.id === documentId);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{document?.title ?? "Proses BPMN"}</CardTitle>
          <CardDescription>
            {[document && `Versi ${document.version}`, elementId && `Penyebab: ${elementId}`]
              .filter(Boolean)
              .join(" · ")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(error || xml.error) && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Diagram tidak bisa digambar</AlertTitle>
              <AlertDescription>{error ?? xml.error?.message}</AlertDescription>
            </Alert>
          )}
          {xml.isPending && <Skeleton className="h-[480px] w-full" />}
          <div
            ref={container}
            data-testid="process-diagram"
            hidden={xml.isPending}
            // bpmn-js draws with inline styles, so the markers' outline needs `!`.
            className="h-[560px] w-full overflow-hidden rounded-2xl border bg-background [&_.nemu-cause_.djs-visual>:first-child]:fill-destructive/10! [&_.nemu-cause_.djs-visual>:first-child]:stroke-destructive! [&_.nemu-cause_.djs-visual>:first-child]:stroke-[4px]! [&_.nemu-path_.djs-visual>:first-child]:stroke-primary! [&_.nemu-path_.djs-visual>:first-child]:stroke-[3px]!"
          />
        </CardContent>
      </Card>
    </>
  );
}
