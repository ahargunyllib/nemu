import { Badge } from "@nemu/ui/components/badge";
import { CircleCheckIcon } from "lucide-react";

import type { ConfirmedStatus as Status } from "../hooks/use-confirmed-status";

/** What the Answer Card shows once the user's press went through: the task ID and its State. */
export function ConfirmedStatus({ status }: { status: Status }) {
  return (
    <section aria-label="Status tugas" className="flex flex-col gap-1 bg-muted px-2 py-1.5">
      <p className="flex items-center gap-1.5 font-medium">
        <CircleCheckIcon className="size-3.5 shrink-0 text-primary" />
        Terkirim
      </p>
      <p>
        ID tugas <strong>{status.taskId}</strong>
      </p>
      <p className="flex items-center gap-1.5">
        Status <Badge variant="secondary">{status.state}</Badge>
      </p>
    </section>
  );
}
