import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Button } from "@nemu/ui/components/button";
import { Spinner } from "@nemu/ui/components/spinner";
import { Play } from "lucide-react";

import type { AjukanPerdinForm } from "@/features/perjalanan-dinas/hooks/use-ajukan-perdin-form";
import { perdinFormSchema } from "@/features/perjalanan-dinas/lib/perdin-form";

/** Sends the form with id `formId`; it stays disabled until every tab is filled in validly. */
export default function StartProcessButton({
  form,
  formId,
}: {
  form: AjukanPerdinForm;
  formId: string;
}) {
  return (
    <form.Subscribe
      selector={(state) => ({
        valid: perdinFormSchema.safeParse(state.values).success,
        isSubmitting: state.isSubmitting,
      })}
    >
      {({ valid, isSubmitting }) => (
        <Button
          type="submit"
          form={formId}
          data-nemu-id={NEMU_IDS.perdinForm.kirim}
          disabled={!valid || isSubmitting}
        >
          {isSubmitting && <Spinner />}
          Start Process
          {!isSubmitting && <Play data-icon="inline-end" />}
        </Button>
      )}
    </form.Subscribe>
  );
}
