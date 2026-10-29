import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { buttonVariants } from "@nemu/ui/components/button";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { cn } from "@nemu/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import SlaClaimTask from "@/features/sla-claims/components/sla-claim-task";
import { useAdvanceSlaClaim } from "@/features/sla-claims/hooks/use-advance-sla-claim";
import { orpc } from "@/shared/api/orpc";

export const Route = createFileRoute("/_auth/sla-claims/$claimId")({ component: SlaClaimPage });

function SlaClaimPage() {
  const { claimId } = Route.useParams();
  const { data } = useQuery(
    orpc.getSlaClaim.queryOptions({ input: { workspaceId: "W-TELKO", claimId } }),
  );
  const { advance, isPending } = useAdvanceSlaClaim(claimId);
  return (
    <>
      <Link
        to="/sla-claims"
        data-nemu-id={NEMU_IDS.slaClaim.returnToTask}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
      >
        <ChevronLeft />
        Kembali ke daftar klaim
      </Link>
      {data ? (
        <SlaClaimTask detail={data} onAdvance={advance} advancing={isPending} />
      ) : (
        <Skeleton className="h-72 w-full" />
      )}
    </>
  );
}
