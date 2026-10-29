import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import SlaClaimTaskList from "@/features/sla-claims/components/sla-claim-task-list";
import { orpc } from "@/shared/api/orpc";

export const Route = createFileRoute("/_auth/sla-claims/")({ component: SlaClaimsPage });

function SlaClaimsPage() {
  const { data: claims } = useQuery(
    orpc.listSlaClaims.queryOptions({ input: { workspaceId: "W-TELKO" } }),
  );
  const { data: tasks } = useQuery(
    orpc.listSlaClaimTasks.queryOptions({ input: { workspaceId: "W-TELKO" } }),
  );
  return (
    <>
      <div>
        <h1 className="text-lg font-semibold">Klaim Kompensasi SLA</h1>
        <p className="text-muted-foreground">
          Task Billing Liaison untuk klaim pelanggan korporat.
        </p>
      </div>
      {claims && tasks ? (
        <SlaClaimTaskList claims={claims} tasks={tasks} />
      ) : (
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      )}
    </>
  );
}
