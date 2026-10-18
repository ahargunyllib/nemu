import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import TaskList from "@/features/perjalanan-dinas/components/task-list";
import TaskListSkeleton from "@/features/perjalanan-dinas/components/task-list-skeleton";
import TaskPlaceholder from "@/features/perjalanan-dinas/components/task-placeholder";
import { orpc } from "@/shared/api/orpc";

export const Route = createFileRoute("/_auth/my-task")({
  component: RouteComponent,
});

/** My Task: the Task column, with a panel filling the space where a Task's sheet opens. */
function RouteComponent() {
  const { data: tasks } = useQuery(orpc.listMyTasks.queryOptions());

  return (
    <div className="flex flex-1 gap-6">
      {tasks ? <TaskList tasks={tasks} /> : <TaskListSkeleton />}
      {tasks ? (
        <TaskPlaceholder hasTasks={tasks.some((instance) => instance.activeTask)} />
      ) : (
        <Skeleton className="flex-1 rounded-lg" />
      )}
    </div>
  );
}
