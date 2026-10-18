import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@nemu/ui/components/empty";
import { Input } from "@nemu/ui/components/input";
import { PageHeading } from "@nemu/ui/shell/page-heading";
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
    <div className="flex w-full max-w-xs flex-col gap-3">
      <PageHeading title="My Tasks" />
      <Input
        type="search"
        aria-label="Search tasks"
        placeholder="Search tasks…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-8 border-transparent bg-muted"
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
          <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Due date
          </h2>
          <ul className="flex flex-col gap-2">
            {shown.map(
              ({ id, activeTask }) =>
                activeTask && (
                  <li key={id}>
                    <Link
                      to="/perdin/task/$instanceId"
                      params={{ instanceId: id }}
                      data-nemu-id={TASK_NEMU_IDS[activeTask.key]}
                      aria-label={`${activeTask.label} ${id}`}
                      className="flex flex-col gap-0.5 rounded-2xl bg-muted px-3 py-2.5 transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <span className="text-sm">{activeTask.label}</span>
                      <span className="text-xs text-muted-foreground">
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
