import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";

import { processDetailQueryOptions } from "@/features/documents/api/process-detail";
import PanelSection from "@/features/documents/components/panel-section";
import ProcessAnswerTest from "@/features/documents/components/process-answer-test";
import ProcessSymptomList from "@/features/documents/components/process-symptom-list";
import ProcessTaskList from "@/features/documents/components/process-task-list";

/**
 * What the panel shows of a BPMN: its symptoms and its tasks, the symptoms first when it has some
 * (a process Nemu explains, like Alur SPP), else the tasks first (one Nemu works through), then
 * the answer test.
 */
export default function ProcessPanelBody({ documentId }: { documentId: string }) {
  const detail = useQuery(processDetailQueryOptions(documentId));
  const hasSymptoms = detail.data?.elements.some((element) => element.symptoms.length) ?? false;

  const symptoms = (
    <PanelSection key="symptoms" title="Gejala yang dikenali Nemu · bisa dikoreksi">
      {detail.data ? (
        <ProcessSymptomList documentId={documentId} elements={detail.data.elements} />
      ) : (
        <Skeleton className="h-16 w-full" />
      )}
    </PanelSection>
  );
  const tasks = (
    <PanelSection key="tasks" title="Task dan halamannya · bisa dikoreksi">
      <ProcessTaskList documentId={documentId} />
    </PanelSection>
  );

  return (
    <>
      {hasSymptoms ? [symptoms, tasks] : [tasks, symptoms]}
      <PanelSection title="Uji jawaban sebelum diaktifkan">
        <ProcessAnswerTest documentId={documentId} />
      </PanelSection>
    </>
  );
}
