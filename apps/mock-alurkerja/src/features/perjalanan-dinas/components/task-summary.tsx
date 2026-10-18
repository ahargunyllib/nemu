import { SheetDescription, SheetHeader, SheetTitle } from "@nemu/ui/components/sheet";
import type { ReactNode } from "react";

import TaskSheetClose from "@/features/perjalanan-dinas/components/task-sheet-close";
import type { ProcessInstanceView } from "@/features/perjalanan-dinas/types/process-instance-view";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Days a Task has before it falls due. The demo keeps no due date, so every Task gets a week. */
const TASK_DUE_DAYS = 7;
// The demo's Satker is in Yogyakarta, so Task dates read in WIB wherever the demo runs.
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

/**
 * The task sheet's orange header: the process, the Task (or the State while no Task is open), the
 * Task's age, dates, and assignee, and the Task's actions as `children`.
 *
 * A Task opens when its State last changed, so `updatedAt` stands in for when it was created.
 */
export default function TaskSummary({
  instance,
  assignee,
  children,
}: {
  instance: ProcessInstanceView;
  assignee: string;
  children?: ReactNode;
}) {
  const created = instance.updatedAt;
  const ageDays = Math.max(0, Math.floor((Date.now() - created.getTime()) / DAY_MS));
  const meta = [
    ["Task Age", ageDays === 1 ? "1 day" : `${ageDays} days`],
    ["Created", dateFormatter.format(created)],
    ["Due Date", dateFormatter.format(new Date(created.getTime() + TASK_DUE_DAYS * DAY_MS))],
    ["Assignee", assignee],
  ] as const;

  return (
    <SheetHeader className="gap-2 bg-linear-to-r from-task-header-from via-task-header-via to-task-header-to px-6 pt-4 pb-4.5 text-task-header-foreground">
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-lg bg-task-header-foreground/20 text-xs font-semibold">
          PD
        </span>
        <SheetDescription className="text-task-header-foreground">
          Perjalanan Dinas
          {instance.activeTask && (
            <span className="text-task-header-foreground/80"> · {instance.activeTask.id}</span>
          )}
        </SheetDescription>
        <TaskSheetClose className="ml-auto -mr-2 hover:bg-task-header-foreground/15 hover:text-task-header-foreground" />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-2">
          <SheetTitle className="font-heading text-2xl font-medium text-task-header-foreground">
            {instance.activeTask?.label ?? instance.state}{" "}
            <span className="align-middle text-xs font-normal text-task-header-foreground/80">
              #{instance.id}
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
