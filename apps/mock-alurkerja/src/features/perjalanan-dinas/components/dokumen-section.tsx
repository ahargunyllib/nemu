import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { FieldError, FieldGroup } from "@nemu/ui/components/field";

import DokumenUploadField from "@/features/perjalanan-dinas/components/dokumen-upload-field";
import type { AjukanPerdinForm } from "@/features/perjalanan-dinas/hooks/use-ajukan-perdin-form";
import { usePerdinErrors } from "@/features/perjalanan-dinas/hooks/use-perdin-errors";

export default function DokumenSection({ form }: { form: AjukanPerdinForm }) {
  const errors = usePerdinErrors(form);

  return (
    <FieldGroup className="gap-3">
      <form.Field name="dokumenUndangan">
        {(field) => (
          <div className="space-y-2">
            {/* The picked file's name comes from the form, so it survives switching tabs. */}
            <DokumenUploadField
              id={field.name}
              label="Undangan"
              nemuId={NEMU_IDS.perdinForm.uploadUndangan}
              namaFile={field.state.value?.name}
              disabled={false}
              onFile={field.handleChange}
            />
            <FieldError>{errors.dokumenUndangan}</FieldError>
          </div>
        )}
      </form.Field>
      <p className="text-sm text-muted-foreground">
        Surat tugas dan rincian biaya terlampir otomatis.
      </p>
    </FieldGroup>
  );
}
