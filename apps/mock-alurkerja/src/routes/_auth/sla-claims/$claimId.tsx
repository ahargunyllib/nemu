import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@nemu/ui/components/empty";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@nemu/ui/components/sheet";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import TaskListSkeleton from "@/features/perjalanan-dinas/components/task-list-skeleton";
import TaskSheetClose from "@/features/perjalanan-dinas/components/task-sheet-close";
import TaskSheetSkeleton from "@/features/perjalanan-dinas/components/task-sheet-skeleton";
import SlaClaimTask from "@/features/sla-claims/components/sla-claim-task";
import SlaClaimTaskColumn from "@/features/sla-claims/components/sla-claim-task-column";
import { useAdvanceSlaClaim } from "@/features/sla-claims/hooks/use-advance-sla-claim";
import { orpc } from "@/shared/api/orpc";

export const Route = createFileRoute("/_auth/sla-claims/$claimId")({ component: SlaClaimPage });

/** A claim Task opens as a sheet beside the My Tasks column; closing it goes back to the column. */
function SlaClaimPage() {
  const { claimId } = Route.useParams();
  const navigate = Route.useNavigate();
  const { user } = Route.useRouteContext();
  const [open, setOpen] = useState(true);
  const { data: claims } = useQuery(
    orpc.listSlaClaims.queryOptions({ input: { workspaceId: "W-TELKO" } }),
  );
  const { data: tasks } = useQuery(
    orpc.listSlaClaimTasks.queryOptions({ input: { workspaceId: "W-TELKO" } }),
  );
  const { data, isPending } = useQuery(
    orpc.getSlaClaim.queryOptions({ input: { workspaceId: "W-TELKO", claimId }, retry: false }),
  );
  const { advance, isPending: advancing } = useAdvanceSlaClaim(claimId);

  return (
    <>
      {claims && tasks ? (
        <SlaClaimTaskColumn claims={claims} tasks={tasks} />
      ) : (
        <TaskListSkeleton />
      )}
      {/* Non-modal so the Nemu overlay stays usable: a modal Sheet makes the rest of the page inert.
          Nemu's Answer Card sits outside the sheet, so a press there (Isi, Tutup) must not close it:
          the × and Esc do. */}
      <Sheet
        open={open}
        modal={false}
        disablePointerDismissal
        onOpenChange={setOpen}
        onOpenChangeComplete={(next) => {
          if (!next) void navigate({ to: "/sla-claims" });
        }}
      >
        <SheetContent
          showCloseButton={false}
          className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
        >
          {isPending ? (
            <TaskSheetSkeleton />
          ) : data ? (
            <SlaClaimTask
              detail={data}
              assignee={user.name}
              onAdvance={advance}
              advancing={advancing}
            />
          ) : (
            <>
              <SheetHeader className="flex-row items-center justify-between px-6 pt-4 pb-0">
                <SheetTitle>Task klaim</SheetTitle>
                <TaskSheetClose className="-mr-2" />
              </SheetHeader>
              <Empty className="m-6 border">
                <EmptyHeader>
                  <EmptyTitle>Klaim tidak ditemukan</EmptyTitle>
                  <EmptyDescription>
                    Tidak ada task klaim {claimId} untuk akun ini.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
