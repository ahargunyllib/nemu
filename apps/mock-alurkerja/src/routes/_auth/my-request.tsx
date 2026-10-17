import { createFileRoute } from "@tanstack/react-router";

import RequestTable from "@/features/perjalanan-dinas/components/request-table";
import { processInstancesOf } from "@/features/perjalanan-dinas/lib/demo-process-instances";

export const Route = createFileRoute("/_auth/my-request")({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = Route.useRouteContext();

  return (
    <>
      <h1 className="text-lg font-semibold">My Request</h1>
      <RequestTable instances={processInstancesOf(user.id)} />
    </>
  );
}
