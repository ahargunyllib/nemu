import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@nemu/ui/components/card";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { CircleAlertIcon, CircleCheckIcon, FileTextIcon, type LucideIcon } from "lucide-react";

import { listDocumentsQueryOptions } from "@/features/documents/api/list-documents";

export default function DocumentStats() {
  const documents = useQuery(listDocumentsQueryOptions());
  const data = documents.data;

  return (
    <>
      <StatCard
        label="Documents"
        hint="Uploaded knowledge documents"
        icon={FileTextIcon}
        value={data?.length}
      />
      <StatCard
        label="Active"
        hint="Used to answer employees"
        icon={CircleCheckIcon}
        value={data?.filter((document) => document.isActive).length}
      />
      <StatCard
        label="Failed"
        hint="Could not be processed"
        icon={CircleAlertIcon}
        value={data?.filter((document) => document.status === "failed").length}
      />
    </>
  );
}

function StatCard({
  label,
  hint,
  icon: Icon,
  value,
}: {
  label: string;
  hint: string;
  icon: LucideIcon;
  value: number | undefined;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl font-semibold tabular-nums">
          {value === undefined ? <Skeleton className="h-9 w-12" /> : value}
        </CardTitle>
        <CardAction>
          <Icon className="size-4 text-muted-foreground" />
        </CardAction>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardHeader>
    </Card>
  );
}
