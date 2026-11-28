import { Badge } from "@nemu/ui/components/badge";
import { Button } from "@nemu/ui/components/button";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";

import { procedureQueryOptions } from "@/features/documents/api/procedure";
import { DocumentExportBpmnButton } from "@/features/documents/components/document-row-controls";
import PanelSection from "@/features/documents/components/panel-section";
import { stepParameters } from "@/features/documents/lib/procedure-steps";

/**
 * A saved recording in the knowledge panel (F3-01..03): its steps in order, each value the
 * teacher gives as a parameter chip, the steps only she does, and Rekam ulang / Ekspor BPMN 2.0.
 */
export default function RecordingSteps({
  documentId,
  title,
}: {
  documentId: string;
  title: string;
}) {
  const procedure = useQuery(procedureQueryOptions(documentId));

  if (procedure.error) return <p className="text-destructive">{procedure.error.message}</p>;
  if (!procedure.data) return <Skeleton className="h-48 w-full" />;
  const firstPage = procedure.data.steps[0]?.urlPattern;

  return (
    <>
      <PanelSection title="Langkah · isian jadi parameter">
        <ol className="grid gap-2">
          {procedure.data.steps.map((step) => (
            <li key={step.id} className="flex items-start gap-3">
              <span className="w-5 shrink-0 text-right text-muted-foreground tabular-nums">
                {step.order}
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <span>{step.instruction}</span>
                {stepParameters(step.valueTemplate).map((name) => (
                  <Badge key={name} variant="outline" className="font-mono">
                    {name}
                  </Badge>
                ))}
                {step.requiresHumanAction && <Badge variant="destructive">dikerjakan guru</Badge>}
              </div>
            </li>
          ))}
        </ol>
      </PanelSection>
      <div className="flex flex-wrap gap-2">
        {firstPage && (
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={firstPage} target="_blank" rel="noreferrer" />}
          >
            Rekam ulang
          </Button>
        )}
        <DocumentExportBpmnButton id={documentId} title={title} label="Ekspor BPMN 2.0" />
      </div>
    </>
  );
}
