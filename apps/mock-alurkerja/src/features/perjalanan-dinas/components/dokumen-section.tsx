import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Field, FieldDescription, FieldError, FieldLabel } from "@nemu/ui/components/field";
import { Input } from "@nemu/ui/components/input";

import PerdinFormSection from "@/features/perjalanan-dinas/components/perdin-form-section";
import type { AjukanPerdinForm } from "@/features/perjalanan-dinas/hooks/use-ajukan-perdin-form";

export default function DokumenSection({ form }: { form: AjukanPerdinForm }) {
  return (
    <PerdinFormSection
      title="D. Dokumen"
      description="Surat tugas dan rincian biaya terlampir otomatis."
    >
      <form.Field name="dokumenUndangan">
        {(field) => (
          <Field data-invalid={!field.state.meta.isValid}>
            <FieldLabel htmlFor={field.name}>Undangan</FieldLabel>
            <Input
              id={field.name}
              name={field.name}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              data-nemu-id={NEMU_IDS.perdinForm.uploadUndangan}
              aria-invalid={!field.state.meta.isValid}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.files?.[0] ?? null)}
            />
            <FieldDescription>PDF atau gambar undangan kegiatan.</FieldDescription>
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
    </PerdinFormSection>
  );
}
