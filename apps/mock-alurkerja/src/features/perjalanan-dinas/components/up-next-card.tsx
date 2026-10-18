import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Button, buttonVariants } from "@nemu/ui/components/button";
import { Card, CardAction, CardFooter, CardHeader, CardTitle } from "@nemu/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@nemu/ui/components/empty";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { cn } from "@nemu/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import {
  DUE_FILTERS,
  type DueFilter,
  daysUntilDue,
  matchesDueFilter,
  taskDueDate,
} from "@/features/perjalanan-dinas/lib/task-due";
import { TASK_NEMU_IDS } from "@/features/perjalanan-dinas/lib/tasks";
import type { ProcessInstanceView } from "@/features/perjalanan-dinas/types/process-instance-view";
import ProcessBadge from "@/features/processes/components/process-badge";
import { PERJALANAN_DINAS } from "@/features/processes/lib/processes";
import { orpc } from "@/shared/api/orpc";

// Due dates read in WIB, as on the task sheet.
const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "Asia/Jakarta",
});

type DueTask = ProcessInstanceView & {
  activeTask: NonNullable<ProcessInstanceView["activeTask"]>;
  due: Date;
  daysLeft: number;
};

/**
 * Up next on Beranda: the signed-in user's Tasks with their due dates, filtered by the chips, each
 * opening its task page.
 */
export default function UpNextCard() {
  const { data } = useQuery(orpc.listMyTasks.queryOptions());
  const [filter, setFilter] = useState<DueFilter>("All Tasks");
  const now = new Date();
  const tasks = data?.flatMap((instance): DueTask[] => {
    if (!instance.activeTask) return [];
    const due = taskDueDate(instance);
    return [
      { ...instance, activeTask: instance.activeTask, due, daysLeft: daysUntilDue(due, now) },
    ];
  });

  return (
    <Card size="sm" className="gap-0 pb-0">
      <CardHeader className="border-b">
        <CardTitle className="font-heading text-base font-medium whitespace-nowrap">
          Up next
        </CardTitle>
        <CardAction className="flex flex-wrap justify-end gap-1.5">
          {DUE_FILTERS.map((option) => {
            const count = tasks?.filter((task) => matchesDueFilter(option, task.daysLeft)).length;
            return (
              <Button
                key={option}
                size="xs"
                variant={option === filter ? "secondary" : "outline"}
                aria-pressed={option === filter}
                onClick={() => setFilter(option)}
                className="font-normal"
              >
                {option}
                {count !== undefined && (
                  <span
                    className={
                      option === "Overdue" && count > 0
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }
                  >
                    {count}
                  </span>
                )}
              </Button>
            );
          })}
        </CardAction>
      </CardHeader>
      {tasks ? (
        <UpNextList
          tasks={tasks.filter((task) => matchesDueFilter(filter, task.daysLeft))}
          filtered={filter !== "All Tasks"}
        />
      ) : (
        <UpNextSkeleton />
      )}
      {tasks && tasks.length > 0 && (
        <CardFooter className="justify-center border-t [.border-t]:py-1.5">
          <Link
            to="/my-task"
            data-nemu-id={NEMU_IDS.task.viewAll}
            className={cn(
              buttonVariants({ variant: "link", size: "sm" }),
              "font-normal text-muted-foreground",
            )}
          >
            View all {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            <ChevronRight className="size-3.5" />
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}

function UpNextList({ tasks, filtered }: { tasks: readonly DueTask[]; filtered: boolean }) {
  if (tasks.length === 0) {
    return (
      <Empty className="py-8">
        <EmptyHeader>
          <EmptyTitle className="text-sm">
            {filtered ? "Tidak ada tugas di sini" : "Tidak ada tugas"}
          </EmptyTitle>
          <EmptyDescription>
            {filtered ? "Coba filter lain." : "Tugas baru akan muncul di sini."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="divide-y">
      {tasks.map((task) => (
        <li key={task.id}>
          <Link
            to="/perdin/task/$instanceId"
            params={{ instanceId: task.id }}
            data-nemu-id={TASK_NEMU_IDS[task.activeTask.key]}
            aria-label={`${task.activeTask.label} ${task.id}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
          >
            <ProcessBadge
              code={PERJALANAN_DINAS.code}
              tone={PERJALANAN_DINAS.tone}
              className="size-8 rounded-lg text-xs font-medium"
            />
            <span className="grid min-w-0 flex-1">
              <span className="truncate font-medium">{task.activeTask.label}</span>
              <span className="truncate text-xs text-muted-foreground">
                {PERJALANAN_DINAS.name}
              </span>
            </span>
            <DueLabel due={task.due} daysLeft={task.daysLeft} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** "Today", the due day ("Nov 13"), or how late the Task is ("1 day late") in red. */
function DueLabel({ due, daysLeft }: { due: Date; daysLeft: number }) {
  const late = -daysLeft;
  return (
    <span
      className={cn(
        "shrink-0 text-sm",
        daysLeft < 0 ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {daysLeft === 0
        ? "Today"
        : daysLeft > 0
          ? shortDate.format(due)
          : `${late} ${late === 1 ? "day" : "days"} late`}
    </span>
  );
}

function UpNextSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="size-7 rounded-lg" />
      <div className="grid flex-1 gap-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-3 w-16" />
    </div>
  );
}
