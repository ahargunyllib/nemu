import { useSelector } from "@tanstack/react-form";

import type { AjukanPerdinForm } from "@/features/perjalanan-dinas/hooks/use-ajukan-perdin-form";
import { type PerdinErrors, shownPerdinErrors } from "@/features/perjalanan-dinas/lib/perdin-form";

/** The error each field shows, from the whole form's values, so tabs stay in step with each other. */
export function usePerdinErrors(form: AjukanPerdinForm) {
  return useSelector(
    form.store,
    (state) => shownPerdinErrors(state.values, state.fieldMeta, state.submissionAttempts > 0),
    { compare: sameErrors },
  );
}

function sameErrors(a: PerdinErrors, b: PerdinErrors): boolean {
  const fields = Object.keys(a) as (keyof PerdinErrors)[];
  return fields.length === Object.keys(b).length && fields.every((field) => a[field] === b[field]);
}
