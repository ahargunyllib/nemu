import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Badge } from "@nemu/ui/components/badge";
import { buttonVariants } from "@nemu/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@nemu/ui/components/empty";
import { cn } from "@nemu/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

type Claim = { id: string; customer: string; fixture: string };
type Task = {
  id: string;
  claimId: string;
  name: string;
  status: string;
  reviewDueOn: string | null;
};

const TASK_ID: Record<string, string> = {
  "KLM-2610-0007": NEMU_IDS.slaClaim.taskKlm26100007,
  "KLM-2610-0009": NEMU_IDS.slaClaim.taskKlm26100009,
  "KLM-2610-0011": NEMU_IDS.slaClaim.taskKlm26100011,
};

export default function SlaClaimTaskList({
  claims,
  tasks,
}: {
  claims: readonly Claim[];
  tasks: readonly Task[];
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
    <ul className="divide-y border">
      {tasks.map((task) => {
        const claim = claimById.get(task.claimId);
        return (
          <li key={task.id}>
            <Link
              to="/sla-claims/$claimId"
              params={{ claimId: task.claimId }}
              data-nemu-id={TASK_ID[task.claimId]}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-auto w-full justify-between gap-4 px-4 py-3",
              )}
            >
              <span className="flex flex-col items-start gap-1 text-left">
                <span className="font-medium">{task.name}</span>
                <span className="text-muted-foreground">
                  {task.claimId} · {claim?.customer ?? "Pelanggan"}
                  {task.reviewDueOn ? ` · batas ${task.reviewDueOn}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Badge variant={task.status === "PERLU_BUKTI" ? "destructive" : "secondary"}>
                  {task.status}
                </Badge>
                <ChevronRight />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
