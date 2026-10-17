import { Badge } from "@nemu/ui/components/badge";
import { buttonVariants } from "@nemu/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@nemu/ui/components/empty";
import { cn } from "@nemu/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import {
  type ProcessInstance,
  formatTanggal,
} from "@/features/perjalanan-dinas/lib/demo-process-instances";

export default function TaskList({ instances }: { instances: readonly ProcessInstance[] }) {
  if (instances.length === 0) {
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
      {instances.map((instance) => (
        <li key={instance.id}>
          <Link
            to="/perdin/task/$instanceId"
            params={{ instanceId: instance.id }}
            data-nemu-id={instance.task.nemuId}
            aria-label={`${instance.task.label} ${instance.id}`}
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "h-auto w-full justify-between gap-4 px-4 py-3",
            )}
          >
            <span className="flex flex-col items-start gap-1 text-left">
              <span className="text-sm font-medium">{instance.task.label}</span>
              <span className="text-muted-foreground">
                {instance.id} · {instance.tujuan} · kembali {formatTanggal(instance.tanggalKembali)}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <Badge variant="secondary">{instance.state}</Badge>
              <ChevronRight />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
