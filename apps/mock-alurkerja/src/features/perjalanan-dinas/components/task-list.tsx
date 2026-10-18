import { Badge } from "@nemu/ui/components/badge";
import { buttonVariants } from "@nemu/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@nemu/ui/components/empty";
import { cn } from "@nemu/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { formatTanggal } from "@/shared/lib/format-tanggal";
import { TASK_NEMU_IDS } from "@/features/perjalanan-dinas/lib/tasks";
import type { ProcessInstanceView } from "@/features/perjalanan-dinas/types/process-instance-view";

export default function TaskList({ tasks }: { tasks: readonly ProcessInstanceView[] }) {
  if (tasks.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Tidak ada tugas</EmptyTitle>
          <EmptyDescription>Tugas baru akan muncul di sini.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="divide-y border">
      {tasks.map(
        (instance) =>
          instance.activeTask && (
            <li key={instance.id}>
              <Link
                to="/perdin/task/$instanceId"
                params={{ instanceId: instance.id }}
                data-nemu-id={TASK_NEMU_IDS[instance.activeTask.key]}
                aria-label={`${instance.activeTask.label} ${instance.id}`}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-auto w-full justify-between gap-4 px-4 py-3 whitespace-normal",
                )}
              >
                <span className="flex flex-col items-start gap-1 text-left">
                  <span className="text-sm font-medium">{instance.activeTask.label}</span>
                  <span className="text-muted-foreground">
                    {instance.activeTask.id} · {instance.kotaTujuan} · kembali{" "}
                    {formatTanggal(instance.tanggalKembali)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant="secondary">{instance.state}</Badge>
                  <ChevronRight />
                </span>
              </Link>
            </li>
          ),
      )}
    </ul>
  );
}
