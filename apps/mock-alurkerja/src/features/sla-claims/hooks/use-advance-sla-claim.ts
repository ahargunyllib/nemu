import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { useDemoPageAction } from "@/features/demo/hooks/use-demo-page-action";
import { orpc, queryClient } from "@/shared/api/orpc";

export function useAdvanceSlaClaim(claimId: string) {
  const mutation = useMutation(
    orpc.advanceSlaClaimTask.mutationOptions({
      onSuccess(task) {
        toast.success(
          task.name === "Persetujuan" && task.approvedBy.length > 0
            ? "Persetujuan dicatat, menunggu penyetuju berikutnya"
            : `Tugas berpindah ke ${task.name}`,
        );
        void queryClient.invalidateQueries({ queryKey: orpc.getSlaClaim.key() });
        void queryClient.invalidateQueries({ queryKey: orpc.listSlaClaimTasks.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const advance = () => mutation.mutate({ workspaceId: "W-TELKO", claimId });
  useDemoPageAction({
    label: mutation.isPending ? "Memajukan tugas…" : "Majukan tugas klaim",
    nemuId: NEMU_IDS.demoPanel.advanceSlaClaim,
    run: advance,
  });
  return { advance, isPending: mutation.isPending };
}
