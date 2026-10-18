import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import TaskList from "@/features/perjalanan-dinas/components/task-list";
import TaskListSkeleton from "@/features/perjalanan-dinas/components/task-list-skeleton";
import { orpc } from "@/shared/api/orpc";

export const Route = createFileRoute("/_auth/my-task")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data: tasks } = useQuery(orpc.listMyTasks.queryOptions());

  return tasks ? <TaskList tasks={tasks} /> : <TaskListSkeleton />;
}
