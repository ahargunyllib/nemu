import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Badge } from "@nemu/ui/components/badge";
import { buttonVariants } from "@nemu/ui/components/button";
import { Card, CardAction, CardFooter, CardHeader, CardTitle } from "@nemu/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@nemu/ui/components/empty";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { cn } from "@nemu/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { TASK_NEMU_IDS } from "@/features/perjalanan-dinas/lib/tasks";
import type { ProcessInstanceView } from "@/features/perjalanan-dinas/types/process-instance-view";
import ProcessBadge from "@/features/processes/components/process-badge";
import { PERJALANAN_DINAS } from "@/features/processes/lib/processes";
import { orpc } from "@/shared/api/orpc";

// The filters as AlurKerja shows them; the demo's Tasks carry no due date, so only All Tasks counts.
const FILTERS = ["Overdue", "Due Today", "Upcoming", "All Tasks"] as const;

const shortDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** Up next on Beranda: the signed-in user's Tasks, each opening its task page. */
export default function UpNextCard() {
  const { data: tasks } = useQuery(orpc.listMyTasks.queryOptions());

  return (
    <Card size="sm" className="gap-0 pb-0">
      <CardHeader className="border-b">
        <CardTitle>Up next</CardTitle>
        <CardAction className="flex flex-wrap justify-end gap-1.5">
          {FILTERS.map((filter) => (
            <Badge key={filter} variant="outline">
              {filter}
              {filter === "All Tasks" && tasks && (
                <span className="text-muted-foreground">{tasks.length}</span>
              )}
            </Badge>
          ))}
        </CardAction>
      </CardHeader>
      {tasks ? <UpNextList tasks={tasks} /> : <UpNextSkeleton />}
      {tasks && tasks.length > 0 && (
        <CardFooter className="justify-center border-t [.border-t]:py-1.5">
          <Link
            to="/my-task"
            data-nemu-id={NEMU_IDS.task.viewAll}
            className={cn(
              buttonVariants({ variant: "link", size: "sm" }),
              "text-xs font-normal text-muted-foreground",
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

function UpNextList({ tasks }: { tasks: readonly ProcessInstanceView[] }) {
  if (tasks.length === 0) {
    return (
      <Empty className="py-8">
        <EmptyHeader>
          <EmptyTitle className="text-sm">Tidak ada tugas</EmptyTitle>
          <EmptyDescription>Tugas baru akan muncul di sini.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="divide-y">
      {tasks.map(
        (instance) =>
          instance.activeTask && (
            <li key={instance.id}>
              <Link
                to="/perdin/task/$instanceId"
                params={{ instanceId: instance.id }}
                data-nemu-id={TASK_NEMU_IDS[instance.activeTask.key]}
                aria-label={`${instance.activeTask.label} ${instance.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
              >
                <ProcessBadge
                  code={PERJALANAN_DINAS.code}
                  tone={PERJALANAN_DINAS.tone}
                  className="size-7 rounded-lg text-[0.625rem]"
                />
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-medium">{instance.activeTask.label}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {PERJALANAN_DINAS.name} · {instance.kotaTujuan}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  Kembali {shortDate.format(new Date(`${instance.tanggalKembali}T00:00:00Z`))}
                </span>
              </Link>
            </li>
          ),
      )}
    </ul>
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
