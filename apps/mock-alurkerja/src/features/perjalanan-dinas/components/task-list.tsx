import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@nemu/ui/components/empty";
import { Input } from "@nemu/ui/components/input";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { TASK_NEMU_IDS } from "@/features/perjalanan-dinas/lib/tasks";
import type { ProcessInstanceView } from "@/features/perjalanan-dinas/types/process-instance-view";

/**
 * The My Tasks column: the heading, a search over the Tasks' labels and IDs, and one compact row
 * per Task, each opening its task page.
 */
export default function TaskList({ tasks }: { tasks: readonly ProcessInstanceView[] }) {
  const [query, setQuery] = useState("");
  const withTask = tasks.filter((instance) => instance.activeTask);
  const needle = query.trim().toLowerCase();
  const shown = withTask.filter(
    ({ id, activeTask }) =>
      !needle ||
      [activeTask?.label, activeTask?.id, id].some((text) => text?.toLowerCase().includes(needle)),
  );

  return (
    <div className="flex w-full max-w-68 flex-col gap-3">
      <h1 className="font-heading text-[22px] leading-7 font-medium">My Tasks</h1>
      <Input
        type="search"
        aria-label="Search tasks"
        placeholder="Search tasks…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-8 border-transparent bg-muted text-[13px] leading-[18px] md:text-[13px]"
      />
      {withTask.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Tidak ada tugas</EmptyTitle>
            <EmptyDescription>Tugas baru akan muncul di sini.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : shown.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Tidak ada tugas yang cocok</EmptyTitle>
            <EmptyDescription>Coba kata kunci lain.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <h2 className="text-[10.5px] leading-3.5 font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Due date
          </h2>
          <ul className="flex flex-col gap-3">
            {shown.map(
              ({ id, activeTask }) =>
                activeTask && (
                  <li key={id}>
                    <Link
                      to="/perdin/task/$instanceId"
                      params={{ instanceId: id }}
                      data-nemu-id={TASK_NEMU_IDS[activeTask.key]}
                      aria-label={`${activeTask.label} ${id}`}
                      className="flex flex-col rounded-xl bg-muted px-3 py-2.5 transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <span className="text-[13px] leading-[18px] font-medium">
                        {activeTask.label}
                      </span>
                      <span className="text-[11.5px] leading-[15px] text-muted-foreground">
                        Perjalanan Dinas · {activeTask.id}
                      </span>
                    </Link>
                  </li>
                ),
            )}
          </ul>
        </>
      )}
    </div>
  );
}
