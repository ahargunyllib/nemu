import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import ProfileCard from "@/features/auth/components/profile-card";
import TaskList from "@/features/perjalanan-dinas/components/task-list";
import TaskListSkeleton from "@/features/perjalanan-dinas/components/task-list-skeleton";
import { orpc } from "@/shared/api/orpc";

export const Route = createFileRoute("/_auth/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = Route.useRouteContext();
  const { data: tasks } = useQuery(orpc.listMyTasks.queryOptions());

  return (
    <>
      <h1 className="text-lg font-semibold">Beranda</h1>
      <ProfileCard user={user} />
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Tugas saya</h2>
        {tasks ? <TaskList tasks={tasks} /> : <TaskListSkeleton />}
      </section>
    </>
  );
}
