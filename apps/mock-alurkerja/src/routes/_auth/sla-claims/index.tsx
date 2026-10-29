import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import TaskListSkeleton from "@/features/perjalanan-dinas/components/task-list-skeleton";
import TaskPlaceholder from "@/features/perjalanan-dinas/components/task-placeholder";
import SlaClaimTaskColumn from "@/features/sla-claims/components/sla-claim-task-column";
import { orpc } from "@/shared/api/orpc";

export const Route = createFileRoute("/_auth/sla-claims/")({ component: SlaClaimsPage });

/** The claim Tasks as My Task's column, with an empty-state panel beside it when there are none. */
function SlaClaimsPage() {
  const { data: claims } = useQuery(
    orpc.listSlaClaims.queryOptions({ input: { workspaceId: "W-TELKO" } }),
  );
  const { data: tasks } = useQuery(
    orpc.listSlaClaimTasks.queryOptions({ input: { workspaceId: "W-TELKO" } }),
  );
  return (
    <div className="flex flex-1 gap-6">
      {claims && tasks ? (
        <SlaClaimTaskColumn claims={claims} tasks={tasks} />
      ) : (
        <TaskListSkeleton />
      )}
      {tasks?.length === 0 && <TaskPlaceholder />}
    </div>
  );
}
