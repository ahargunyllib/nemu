import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import DashboardGreeting from "@/features/dashboard/components/dashboard-greeting";
import MyPerformanceCard from "@/features/dashboard/components/my-performance-card";
import TaskListSkeleton from "@/features/perjalanan-dinas/components/task-list-skeleton";
import UpNextCard from "@/features/perjalanan-dinas/components/up-next-card";
import FavoriteProcessesCard from "@/features/processes/components/favorite-processes-card";
import SlaClaimTaskList from "@/features/sla-claims/components/sla-claim-task-list";
import { orpc } from "@/shared/api/orpc";

export const Route = createFileRoute("/_auth/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = Route.useRouteContext();
  const isTelco = user.workspaceId === "W-TELKO";
  const { data: claims } = useQuery(
    orpc.listSlaClaims.queryOptions({
      input: { workspaceId: "W-TELKO" },
      enabled: isTelco,
    }),
  );
  const { data: claimTasks } = useQuery(
    orpc.listSlaClaimTasks.queryOptions({
      input: { workspaceId: "W-TELKO" },
      enabled: isTelco,
    }),
  );

  if (isTelco) {
    return (
      <>
        <DashboardGreeting name={user.name} />
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Tugas saya</h2>
          {claims && claimTasks ? (
            <SlaClaimTaskList claims={claims} tasks={claimTasks} />
          ) : (
            <TaskListSkeleton />
          )}
        </section>
      </>
    );
  }

  return (
    <>
      <DashboardGreeting name={user.name} />
      <FavoriteProcessesCard />
      <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
        <UpNextCard />
        <MyPerformanceCard />
      </div>
    </>
  );
}
