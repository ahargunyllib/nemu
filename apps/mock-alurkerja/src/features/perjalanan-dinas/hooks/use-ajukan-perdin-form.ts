import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import {
  PERDIN_FORM_DEFAULTS,
  perdinFormSchema,
  toAjukanPerjalananDinasInput,
} from "@/features/perjalanan-dinas/lib/perdin-form";
import { orpc } from "@/shared/api/orpc";

/** The Ajukan Perjalanan Dinas form: Start Process creates a Process Instance and opens My Request. */
export function useAjukanPerdinForm() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const ajukan = useMutation(orpc.ajukanPerjalananDinas.mutationOptions());

  return useForm({
    defaultValues: PERDIN_FORM_DEFAULTS,
    // Fields show their errors through `usePerdinErrors`; this only guards the send itself.
    validators: { onSubmit: perdinFormSchema },
    onSubmit: async ({ value }) => {
      try {
        const instance = await ajukan.mutateAsync(toAjukanPerjalananDinasInput(value));
        toast.success(`Pengajuan ${instance.id} terkirim dengan status ${instance.state}`);
        await queryClient.invalidateQueries({ queryKey: orpc.listMyProcessInstances.key() });
        await navigate({ to: "/my-request" });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Pengajuan gagal dikirim");
      }
    },
  });
}

export type AjukanPerdinForm = ReturnType<typeof useAjukanPerdinForm>;
