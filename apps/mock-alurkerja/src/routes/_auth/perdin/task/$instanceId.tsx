import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { buttonVariants } from "@nemu/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@nemu/ui/components/empty";
import { cn } from "@nemu/ui/lib/utils";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import TaskSummary from "@/features/perjalanan-dinas/components/task-summary";
import { processInstancesOf } from "@/features/perjalanan-dinas/lib/demo-process-instances";

export const Route = createFileRoute("/_auth/perdin/task/$instanceId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = Route.useRouteContext();
  const { instanceId } = Route.useParams();
  const instance = processInstancesOf(user.id).find((candidate) => candidate.id === instanceId);

  return (
    <>
      <Link
        to="/my-task"
        data-nemu-id={NEMU_IDS.taskDetail.back}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
      >
        <ChevronLeft />
        Kembali ke My Task
      </Link>
      {instance ? (
        <TaskSummary instance={instance} />
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Tugas tidak ditemukan</EmptyTitle>
            <EmptyDescription>Tidak ada tugas {instanceId} untuk akun ini.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </>
  );
}
