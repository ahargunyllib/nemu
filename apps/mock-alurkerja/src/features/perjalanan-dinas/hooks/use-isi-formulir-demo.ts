import type { AjukanPerdinForm } from "@/features/perjalanan-dinas/hooks/use-ajukan-perdin-form";
import {
  DEMO_UNDANGAN_FILE_NAME,
  PERDIN_FORM_DEMO_VALUES,
} from "@/features/perjalanan-dinas/lib/perdin-form";

/** Fills every tab of the Ajukan Perjalanan Dinas form with the demo trip, but the Momen 2 lodging fields. */
export function useIsiFormulirDemo(form: AjukanPerdinForm) {
  return () => {
    for (const [name, value] of Object.entries(PERDIN_FORM_DEMO_VALUES)) {
      form.setFieldValue(name as keyof typeof PERDIN_FORM_DEMO_VALUES, value);
    }
    form.setFieldValue(
      "dokumenUndangan",
      new File(["%PDF-1.7"], DEMO_UNDANGAN_FILE_NAME, { type: "application/pdf" }),
    );
  };
}
