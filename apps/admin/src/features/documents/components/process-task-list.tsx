import { Badge } from "@nemu/ui/components/badge";
import { Button } from "@nemu/ui/components/button";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { processDetailQueryOptions } from "@/features/documents/api/process-detail";
import ProcessElementForm from "@/features/documents/components/process-element-form";
import type { ProcessElement } from "@/features/documents/types/process";

/**
 * "Task dan halamannya · bisa dikoreksi" (WS-04, F3-19): each BPMN task with who does it and the
 * page Nemu opens for it. "ubah" corrects a person's task in place; the system's are never done
 * by Nemu.
 */
export default function ProcessTaskList({ documentId }: { documentId: string }) {
  const detail = useQuery(processDetailQueryOptions(documentId));
  const [editing, setEditing] = useState<string | null>(null);

  if (detail.error) return <p className="text-destructive">{detail.error.message}</p>;
  if (!detail.data) {
    return (
      <div className="grid gap-3">
        {["a", "b", "c"].map((key) => (
          <Skeleton key={key} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  const tasks = detail.data.elements.filter((element) => element.kind === "task");
  if (!tasks.length) return <p className="text-muted-foreground">BPMN ini tidak punya task.</p>;

  return (
    <ul className="grid gap-3">
      {tasks.map((task) =>
        editing === task.elementId ? (
          <li key={task.elementId}>
            <ProcessElementForm
              documentId={documentId}
              element={task}
              onDone={() => setEditing(null)}
            />
          </li>
        ) : (
          <li key={task.elementId} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{task.name}</span>
                <Badge variant={task.performer === "system" ? "secondary" : "outline"}>
                  {performerLabel(task)}
                </Badge>
              </div>
              <div className="truncate text-muted-foreground">{whereLine(task)}</div>
            </div>
            {task.performer === "person" && (
              <Button
                variant="link"
                size="sm"
                aria-label={`Ubah ${task.name}`}
                onClick={() => setEditing(task.elementId)}
              >
                ubah
              </Button>
            )}
          </li>
        ),
      )}
    </ul>
  );
}

/** "Guru" (the task's lane) or "Sistem". */
function performerLabel(task: ProcessElement): string {
  if (task.performer === "system") return "Sistem";
  return task.lane ?? "Pengguna";
}

/** "Cabang Setoran · Al-Quran › Setoran baru", or "tidak dikerjakan Nemu" for the system's. */
function whereLine(task: ProcessElement): string {
  if (task.performer === "system") return "tidak dikerjakan Nemu";
  const page = task.link ?? task.page ?? "belum ada halaman";
  return task.branch ? `Cabang ${task.branch} · ${page}` : page;
}
