import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/shared/api/orpc";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Gagal mengubah data demo";
}

/** The demo panel: pick one of the user's Process Instances and move its State, or reset the demo. */
export function useDemoPanel() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries();
  const { data: instances } = useQuery(orpc.listMyProcessInstances.queryOptions());
  const [pickedId, setPickedId] = useState<string | null>(null);
  const selected = instances?.find((instance) => instance.id === pickedId) ?? instances?.[0];

  const majukan = useMutation(
    orpc.majukanState.mutationOptions({
      onSuccess: (instance) => {
        toast.success(`${instance.id} sekarang ${instance.state}`);
        return refresh();
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  );

  const reset = useMutation(
    orpc.resetDemo.mutationOptions({
      onSuccess: () => {
        toast.success("Data demo dikembalikan ke awal");
        setPickedId(null);
        return refresh();
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  );

  return {
    instances,
    selected,
    pick: setPickedId,
    majukan: () => selected && majukan.mutate({ instanceId: selected.id }),
    isMajukanPending: majukan.isPending,
    reset: () => reset.mutate({}),
    isResetPending: reset.isPending,
  };
}
