import { useQuery } from "@tanstack/react-query";
import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import TaskList from "@/features/perjalanan-dinas/components/task-list";
import TaskListSkeleton from "@/features/perjalanan-dinas/components/task-list-skeleton";
import { orpc } from "@/shared/api/orpc";

export const Route = createFileRoute("/_auth/my-task")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data: tasks } = useQuery(orpc.listMyTasks.queryOptions());

  return (
    <>
      <PageHeading title="My Task" />
      {tasks ? <TaskList tasks={tasks} /> : <TaskListSkeleton />}
    </>
  );
}
