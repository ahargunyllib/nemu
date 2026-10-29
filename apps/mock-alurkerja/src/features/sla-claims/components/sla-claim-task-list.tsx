import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Badge } from "@nemu/ui/components/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@nemu/ui/components/empty";
import { Link } from "@tanstack/react-router";

import { formatClaimPeriod } from "@/features/sla-claims/lib/stages";
import type { SlaClaim, SlaClaimTaskRow } from "@/features/sla-claims/types/sla-claim-task-row";

const TASK_ID: Record<string, string> = {
  "KLM-2610-0007": NEMU_IDS.slaClaim.taskKlm26100007,
  "KLM-2610-0009": NEMU_IDS.slaClaim.taskKlm26100009,
  "KLM-2610-0011": NEMU_IDS.slaClaim.taskKlm26100011,
};

/**
 * One compact row per claim Task, each opening its task sheet: the Task and claim number over the
 * customer, service, and period.
 */
export default function SlaClaimTaskList({
  claims,
  tasks,
}: {
  claims: readonly SlaClaim[];
  tasks: readonly SlaClaimTaskRow[];
}) {
  if (tasks.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Tidak ada task klaim</EmptyTitle>
          <EmptyDescription>Task klaim baru akan muncul di sini.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  const claimById = new Map(claims.map((claim) => [claim.id, claim]));
  return (
    <ul className="flex flex-col gap-3">
      {tasks.map((task) => {
        const claim = claimById.get(task.claimId);
        return (
          <li key={task.id}>
            <Link
              to="/sla-claims/$claimId"
              params={{ claimId: task.claimId }}
              data-nemu-id={TASK_ID[task.claimId]}
              className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2.5 ring-1 ring-transparent transition-[background-color,box-shadow] outline-none hover:bg-background hover:shadow-sm hover:ring-border focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13px] leading-[18px] font-medium">
                  {task.name} · {task.claimId}
                </span>
                <span className="text-[11.5px] leading-[15px] text-muted-foreground">
                  {[claim?.customer, claim?.serviceId, claim && formatClaimPeriod(claim.period)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              {task.status !== "OPEN" && (
                <Badge variant={task.status === "PERLU_BUKTI" ? "destructive" : "secondary"}>
                  {task.status}
                </Badge>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
