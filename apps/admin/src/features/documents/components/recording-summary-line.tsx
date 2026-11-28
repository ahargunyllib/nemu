import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";

import { procedureQueryOptions } from "@/features/documents/api/procedure";

/** "Rekaman · 10 langkah · direkam Pak Rizal": the recording panel's summary line. */
export default function RecordingSummaryLine({ id, version }: { id: string; version: string }) {
  const procedure = useQuery(procedureQueryOptions(id));
  if (!procedure.data) return <Skeleton className="h-5 w-48" />;
  const { steps, recordedBy } = procedure.data;
  return (
    <>
      Rekaman · {steps.length} langkah{recordedBy ? ` · direkam ${recordedBy}` : ""} · versi{" "}
      {version}
    </>
  );
}
