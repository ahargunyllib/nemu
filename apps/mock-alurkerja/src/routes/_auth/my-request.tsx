import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import RequestTable from "@/features/perjalanan-dinas/components/request-table";
import RequestTableSkeleton from "@/features/perjalanan-dinas/components/request-table-skeleton";
import { orpc } from "@/shared/api/orpc";

export const Route = createFileRoute("/_auth/my-request")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data: instances } = useQuery(orpc.listMyProcessInstances.queryOptions());

  return (
    <>
      <h1 className="text-lg font-semibold">My Request</h1>
      {instances ? <RequestTable instances={instances} /> : <RequestTableSkeleton />}
    </>
  );
}
