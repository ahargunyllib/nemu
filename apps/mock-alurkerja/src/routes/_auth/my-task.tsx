import { createFileRoute } from "@tanstack/react-router";

import TaskList from "@/features/perjalanan-dinas/components/task-list";
import { processInstancesOf } from "@/features/perjalanan-dinas/lib/demo-process-instances";

export const Route = createFileRoute("/_auth/my-task")({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = Route.useRouteContext();

  return (
    <>
      <h1 className="text-lg font-semibold">My Task</h1>
      <TaskList instances={processInstancesOf(user.id)} />
    </>
  );
}
