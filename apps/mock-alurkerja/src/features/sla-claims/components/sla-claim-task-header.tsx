import { Badge } from "@nemu/ui/components/badge";
import { SheetDescription, SheetHeader, SheetTitle } from "@nemu/ui/components/sheet";
import type { ReactNode } from "react";

import TaskSheetClose from "@/features/perjalanan-dinas/components/task-sheet-close";
import type { SlaClaimDetail } from "@/features/sla-claims/components/sla-claim-task";
import { formatClaimDay, stageLabel } from "@/features/sla-claims/lib/stages";

/**
 * The claim task sheet's orange header, in the same App colours as the Perjalanan Dinas task: the
 * process and stage, the Task with its claim number, the claim's dates and assignee, and the
 * Task's actions as `children`.
 */
export default function SlaClaimTaskHeader({
  detail,
  assignee,
  children,
}: {
  detail: SlaClaimDetail;
  assignee: string;
  children?: ReactNode;
}) {
  const { claim, task } = detail;
  const stage = stageLabel(task.name);
  const meta: [string, string][] = [
    ["Klaim diterima", formatClaimDay(claim.receivedAt)],
    ...(task.reviewDueOn
      ? [["Tenggat telaah", formatClaimDay(task.reviewDueOn)] as [string, string]]
      : []),
    ["Assignee", assignee],
  ];

  return (
    <SheetHeader className="gap-2 bg-linear-to-r from-task-header-from via-task-header-via to-task-header-to px-6 pt-4 pb-4.5 text-task-header-foreground">
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-lg bg-task-header-foreground/20 text-xs font-semibold">
          KS
        </span>
        <SheetDescription className="text-task-header-foreground">
          Klaim Kompensasi SLA{stage && ` · ${stage}`}
        </SheetDescription>
        {task.status !== "OPEN" && (
          <Badge variant={task.status === "PERLU_BUKTI" ? "destructive" : "secondary"}>
            {task.status}
          </Badge>
        )}
        <TaskSheetClose className="ml-auto -mr-2 hover:bg-task-header-foreground/15 hover:text-task-header-foreground" />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-2">
          <SheetTitle className="font-heading text-2xl font-medium text-task-header-foreground">
            {task.name}{" "}
            <span className="align-middle text-xs font-normal text-task-header-foreground/80">
              #{claim.id}
            </span>
          </SheetTitle>
          <dl className="flex flex-wrap gap-x-6 gap-y-1">
            {meta.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-task-header-foreground/80">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        {children && <div className="flex gap-2">{children}</div>}
      </div>
    </SheetHeader>
  );
}
