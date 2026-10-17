import type { AjukanPerdinForm } from "@/features/perjalanan-dinas/hooks/use-ajukan-perdin-form";
import {
  DEMO_UNDANGAN_FILE_NAME,
  PERDIN_FORM_DEMO_VALUES,
} from "@/features/perjalanan-dinas/lib/perdin-form";

/** Fills the Ajukan Perjalanan Dinas form with the demo trip, up to the Momen 2 lodging fields. */
export function useIsiFormulirDemo(form: AjukanPerdinForm) {
  return () => {
    for (const [name, value] of Object.entries(PERDIN_FORM_DEMO_VALUES)) {
      form.setFieldValue(name as keyof typeof PERDIN_FORM_DEMO_VALUES, value);
    }

    const undangan = new File(["%PDF-1.7"], DEMO_UNDANGAN_FILE_NAME, { type: "application/pdf" });
    form.setFieldValue("dokumenUndangan", undangan);
    // The file input is uncontrolled, so put the file on it too, or it still reads "No file chosen".
    const input = document.getElementById("dokumenUndangan");
    if (input instanceof HTMLInputElement) {
      const files = new DataTransfer();
      files.items.add(undangan);
      input.files = files.files;
    }
  };
}
