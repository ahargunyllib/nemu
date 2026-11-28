import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";

import { processDetailQueryOptions } from "@/features/documents/api/process-detail";
import PanelSection from "@/features/documents/components/panel-section";
import ProcessAnswerTest from "@/features/documents/components/process-answer-test";
import ProcessSymptomList from "@/features/documents/components/process-symptom-list";
import ProcessTaskList from "@/features/documents/components/process-task-list";

/**
 * What the panel shows of a BPMN: its symptoms and its tasks, then the answer test. The symptoms
 * come first when the system does most of the tasks (a process Nemu explains, like Alur SPP), the
 * tasks first when people do (one Nemu works through, like Catat Hafalan Tahfidz).
 */
export default function ProcessPanelBody({ documentId }: { documentId: string }) {
  const detail = useQuery(processDetailQueryOptions(documentId));
  const tasks = detail.data?.elements.filter((element) => element.kind === "task") ?? [];
  const byPeople = tasks.filter((task) => task.performer === "person").length;
  // Mostly the system's tasks (Alur SPP): Nemu explains this process, so its symptoms lead.
  const symptomsFirst = byPeople < tasks.length - byPeople;

  const symptoms = (
    <PanelSection key="symptoms" title="Gejala yang dikenali Nemu · bisa dikoreksi">
      {detail.data ? (
        <ProcessSymptomList documentId={documentId} elements={detail.data.elements} />
      ) : (
        <Skeleton className="h-16 w-full" />
      )}
    </PanelSection>
  );
  const taskList = (
    <PanelSection key="tasks" title="Task dan halamannya · bisa dikoreksi">
      <ProcessTaskList documentId={documentId} />
    </PanelSection>
  );

  return (
    <>
      {symptomsFirst ? [symptoms, taskList] : [taskList, symptoms]}
      <PanelSection title="Uji jawaban sebelum diaktifkan">
        <ProcessAnswerTest documentId={documentId} />
      </PanelSection>
    </>
  );
}
