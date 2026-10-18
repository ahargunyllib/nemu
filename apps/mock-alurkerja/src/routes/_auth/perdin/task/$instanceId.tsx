import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@nemu/ui/components/empty";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@nemu/ui/components/sheet";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import PertanggungjawabanTask from "@/features/perjalanan-dinas/components/pertanggungjawaban-task";
import TaskList from "@/features/perjalanan-dinas/components/task-list";
import TaskListSkeleton from "@/features/perjalanan-dinas/components/task-list-skeleton";
import TaskSheetClose from "@/features/perjalanan-dinas/components/task-sheet-close";
import TaskSheetSkeleton from "@/features/perjalanan-dinas/components/task-sheet-skeleton";
import TaskSummary from "@/features/perjalanan-dinas/components/task-summary";
import { orpc } from "@/shared/api/orpc";

export const Route = createFileRoute("/_auth/perdin/task/$instanceId")({
  component: RouteComponent,
});

/** A Task opens as a sheet over My Task, so the list stays in view and opens other Tasks. */
function RouteComponent() {
  const { instanceId } = Route.useParams();
  const navigate = Route.useNavigate();
  const { user } = Route.useRouteContext();
  const { data: tasks } = useQuery(orpc.listMyTasks.queryOptions());
  const { data: instance, isPending } = useQuery(
    orpc.getProcessInstance.queryOptions({ input: { instanceId }, retry: false }),
  );

  return (
    <>
      {tasks ? <TaskList tasks={tasks} /> : <TaskListSkeleton />}
      <Sheet
        open
        modal={false}
        disablePointerDismissal
        onOpenChange={(open) => {
          if (!open) void navigate({ to: "/my-task" });
        }}
      >
        {/* data-task-sheet: index.css keeps the side menu, top bar, and list clear of its overlay. */}
        <SheetContent
          data-task-sheet
          showCloseButton={false}
          className="gap-0 data-[side=right]:top-14 data-[side=right]:h-auto data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
        >
          {isPending ? (
            <TaskSheetSkeleton />
          ) : instance ? (
            instance.state === "Pertanggungjawaban" || instance.state === "Verifikasi" ? (
              <PertanggungjawabanTask instance={instance} assignee={user.name} />
            ) : (
              <TaskSummary instance={instance} assignee={user.name} />
            )
          ) : (
            <>
              <SheetHeader className="flex-row items-center justify-between px-6 pt-4 pb-0">
                <SheetTitle>Tugas</SheetTitle>
                <TaskSheetClose className="-mr-2" />
              </SheetHeader>
              <Empty className="m-6 border">
                <EmptyHeader>
                  <EmptyTitle>Tugas tidak ditemukan</EmptyTitle>
                  <EmptyDescription>Tidak ada tugas {instanceId} untuk akun ini.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
