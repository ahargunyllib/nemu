import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@nemu/ui/components/empty";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@nemu/ui/components/sheet";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

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

/** A Task opens as a sheet over My Task: it slides in, and slides out before going back. */
function RouteComponent() {
  const { instanceId } = Route.useParams();
  const navigate = Route.useNavigate();
  const { user } = Route.useRouteContext();
  // Opened after mount so the Sheet plays its enter transition; mounting it open skips it.
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(true), []);
  const { data: tasks } = useQuery(orpc.listMyTasks.queryOptions());
  const { data: instance, isPending } = useQuery(
    orpc.getProcessInstance.queryOptions({ input: { instanceId }, retry: false }),
  );

  return (
    <>
      {tasks ? <TaskList tasks={tasks} /> : <TaskListSkeleton />}
      {/* Non-modal so the Nemu overlay stays usable: a modal Sheet makes the rest of the page inert. */}
      <Sheet
        open={open}
        modal={false}
        onOpenChange={(next, details) => {
          if (!next && isInNemuOverlay(details.event)) return details.cancel();
          setOpen(next);
        }}
        onOpenChangeComplete={(next) => {
          if (!next) void navigate({ to: "/my-task" });
        }}
      >
        <SheetContent
          showCloseButton={false}
          className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
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

/** Whether a press or focus move landed in the Nemu extension, which must not close the sheet. */
function isInNemuOverlay(event: Event | undefined) {
  const target = event instanceof FocusEvent ? event.relatedTarget : event?.target;
  if (!(target instanceof Element)) return false;
  // The extension renders in a shadow root under <nemu-overlay>, and closest() stops at the root.
  const root = target.getRootNode();
  const element = root instanceof ShadowRoot ? root.host : target;
  return element.closest("nemu-overlay") !== null;
}
