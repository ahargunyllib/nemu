import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Alert, AlertAction, AlertDescription } from "@nemu/ui/components/alert";
import { buttonVariants } from "@nemu/ui/components/button";
import { cn } from "@nemu/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";

/** Tells a record page which claim Task it serves, with the way back to that Task. */
export default function ClaimOriginBanner({
  claimId,
  taskName,
}: {
  claimId: string;
  taskName: string;
}) {
  return (
    <Alert className="rounded-2xl border-task-header-to/40 bg-task-header-to/10 has-data-[slot=alert-action]:pr-44">
      <AlertDescription className="text-foreground">
        Kamu datang dari tugas {taskName} · {claimId}
      </AlertDescription>
      <AlertAction className="top-1/2 -translate-y-1/2">
        <Link
          to="/sla-claims/$claimId"
          params={{ claimId }}
          data-nemu-id={NEMU_IDS.slaClaim.returnToTask}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Kembali ke tugas
        </Link>
      </AlertAction>
    </Alert>
  );
}
