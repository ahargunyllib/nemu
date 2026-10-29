import { SheetDescription, SheetHeader, SheetTitle } from "@nemu/ui/components/sheet";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import TaskSheetClose from "@/features/perjalanan-dinas/components/task-sheet-close";
import { dayToDate, daysUntil } from "@/features/perjalanan-dinas/lib/task-due";
import type { ProcessInstanceView } from "@/features/perjalanan-dinas/types/process-instance-view";
import { orpc } from "@/shared/api/orpc";

// Task dates are days on the demo clock, so they read in UTC (see `dayToDate`).
const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/**
 * The task sheet's orange header: the process, the Task (or the State while no Task is open), the
 * Task's age and dates on the demo clock, the assignee, and the Task's actions as `children`.
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
  const { data: clock } = useQuery(orpc.getDemoClock.queryOptions({ staleTime: Infinity }));
  const task = instance.activeTask;
  const ageDays = task && clock && Math.max(0, -daysUntil(task.openedOn, clock.today));
  // Without an open Task there is nothing to date, so only the assignee shows.
  const meta: [string, ReactNode][] = task
    ? [
        [
          "Task Age",
          ageDays == null ? (
            <Skeleton className="mt-1 h-4 w-12 bg-task-header-foreground/20" />
          ) : (
            `${ageDays} ${ageDays === 1 ? "day" : "days"}`
          ),
        ],
        ["Created", dateFormatter.format(dayToDate(task.openedOn))],
        ["Due Date", dateFormatter.format(dayToDate(task.dueOn))],
        ["Assignee", assignee],
      ]
    : [["Assignee", assignee]];

  return (
    <SheetHeader className="gap-2 bg-linear-to-r from-task-header-from via-task-header-via to-task-header-to px-6 pt-4 pb-4.5 text-task-header-foreground">
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-lg bg-task-header-foreground/20 text-xs font-semibold">
          PD
        </span>
        <SheetDescription className="text-task-header-foreground">
          Perjalanan Dinas
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
