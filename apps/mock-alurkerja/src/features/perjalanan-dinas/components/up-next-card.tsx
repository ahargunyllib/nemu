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
  dayToDate,
  daysUntil,
  matchesDueFilter,
} from "@/features/perjalanan-dinas/lib/task-due";
import { TASK_NEMU_IDS } from "@/features/perjalanan-dinas/lib/tasks";
import type { ProcessInstanceView } from "@/features/perjalanan-dinas/types/process-instance-view";
import ProcessBadge from "@/features/processes/components/process-badge";
import { PERJALANAN_DINAS } from "@/features/processes/lib/processes";
import { orpc } from "@/shared/api/orpc";

// Due dates are days on the demo clock, so they read in UTC (see `dayToDate`).
const shortDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

type DueTask = ProcessInstanceView & {
  activeTask: NonNullable<ProcessInstanceView["activeTask"]>;
  daysLeft: number;
};

/**
 * Tugas berikutnya on Beranda: the signed-in user's Tasks with their due dates, filtered by the chips, each
 * opening its task page. Days left count from the demo clock's day, the same "today" as the AI.
 */
export default function UpNextCard() {
  const { data } = useQuery(orpc.listMyTasks.queryOptions());
  const { data: clock } = useQuery(orpc.getDemoClock.queryOptions({ staleTime: Infinity }));
  const [filter, setFilter] = useState<DueFilter>("Semua tugas");
  const tasks =
    clock &&
    data?.flatMap((instance): DueTask[] => {
      const { activeTask } = instance;
      if (!activeTask) return [];
      return [{ ...instance, activeTask, daysLeft: daysUntil(activeTask.dueOn, clock.today) }];
    });

  return (
    <Card size="sm" className="gap-0 pb-0">
      <CardHeader className="border-b">
        <CardTitle className="font-heading text-base font-medium whitespace-nowrap">
          Tugas berikutnya
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
                      option === "Terlambat" && count > 0
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
          filtered={filter !== "Semua tugas"}
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
            Lihat semua {tasks.length} tugas
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
            <DueLabel dueOn={task.activeTask.dueOn} daysLeft={task.daysLeft} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** "Hari ini", the due day ("13 Nov"), or how late the Task is ("Terlambat 1 hari") in red. */
function DueLabel({ dueOn, daysLeft }: { dueOn: string; daysLeft: number }) {
  const late = -daysLeft;
  return (
    <span
      className={cn(
        "shrink-0 text-sm",
        daysLeft < 0 ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {daysLeft === 0
        ? "Hari ini"
        : daysLeft > 0
          ? shortDate.format(dayToDate(dueOn))
          : `Terlambat ${late} hari`}
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
