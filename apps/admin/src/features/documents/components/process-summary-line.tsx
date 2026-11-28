import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";

import { processDetailQueryOptions } from "@/features/documents/api/process-detail";

/** "BPMN · 4 task, 2 gateway · versi 1": the BPMN panel's summary line. */
export default function ProcessSummaryLine({ id, version }: { id: string; version: string }) {
  const detail = useQuery(processDetailQueryOptions(id));
  if (!detail.data) return <Skeleton className="h-5 w-48" />;
  return (
    <>
      BPMN · {detail.data.taskCount} task, {detail.data.gatewayCount} gateway · versi {version}
    </>
  );
}
