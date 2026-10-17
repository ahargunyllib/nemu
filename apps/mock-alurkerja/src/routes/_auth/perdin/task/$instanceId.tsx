import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { buttonVariants } from "@nemu/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@nemu/ui/components/empty";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { cn } from "@nemu/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import PertanggungjawabanTask from "@/features/perjalanan-dinas/components/pertanggungjawaban-task";
import TaskSummary from "@/features/perjalanan-dinas/components/task-summary";
import { orpc } from "@/shared/api/orpc";

export const Route = createFileRoute("/_auth/perdin/task/$instanceId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { instanceId } = Route.useParams();
  const { data: instance, isPending } = useQuery(
    orpc.getProcessInstance.queryOptions({ input: { instanceId }, retry: false }),
  );

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
      {isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : instance ? (
        <>
          <TaskSummary instance={instance} />
          {(instance.state === "Pertanggungjawaban" || instance.state === "Verifikasi") && (
            <PertanggungjawabanTask instance={instance} />
          )}
        </>
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
