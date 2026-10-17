import { createFileRoute } from "@tanstack/react-router";

import ProfileCard from "@/features/auth/components/profile-card";
import TaskList from "@/features/perjalanan-dinas/components/task-list";
import { processInstancesOf } from "@/features/perjalanan-dinas/lib/demo-process-instances";

export const Route = createFileRoute("/_auth/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = Route.useRouteContext();

  return (
    <>
      <h1 className="text-lg font-semibold">Beranda</h1>
      <ProfileCard user={user} />
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Tugas saya</h2>
        <TaskList instances={processInstancesOf(user.id)} />
      </section>
    </>
  );
}
