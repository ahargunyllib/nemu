import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { JENIS_PERJALANAN, KOTA_TUJUAN, type KotaTujuan } from "@nemu/contracts/process-instance";
import { Field, FieldDescription, FieldError, FieldLabel } from "@nemu/ui/components/field";
import { Input } from "@nemu/ui/components/input";
import { Textarea } from "@nemu/ui/components/textarea";

import OptionSelect from "@/features/perjalanan-dinas/components/option-select";
import PerdinFormSection from "@/features/perjalanan-dinas/components/perdin-form-section";
import type { AjukanPerdinForm } from "@/features/perjalanan-dinas/hooks/use-ajukan-perdin-form";

const KOTA_OPTIONS = Object.keys(KOTA_TUJUAN);

function provinsiOf(kota: string): string | undefined {
  return kota in KOTA_TUJUAN ? KOTA_TUJUAN[kota as KotaTujuan] : undefined;
}

export default function JenisTujuanSection({ form }: { form: AjukanPerdinForm }) {
  return (
    <PerdinFormSection title="A. Jenis dan tujuan">
      <form.Field name="jenisPerjalanan">
        {(field) => (
          <Field data-invalid={!field.state.meta.isValid}>
            <FieldLabel htmlFor={field.name}>Jenis perjalanan</FieldLabel>
            <OptionSelect
              id={field.name}
              nemuId={NEMU_IDS.perdinForm.jenisPerjalanan}
              options={JENIS_PERJALANAN}
              placeholder="Pilih jenis perjalanan"
              value={field.state.value}
              invalid={!field.state.meta.isValid}
              onChange={field.handleChange}
            />
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>

      <form.Field name="nomorSuratTugas">
        {(field) => (
          <Field data-invalid={!field.state.meta.isValid}>
            <FieldLabel htmlFor={field.name}>Nomor surat tugas</FieldLabel>
            <Input
              id={field.name}
              name={field.name}
              data-nemu-id={NEMU_IDS.perdinForm.nomorSuratTugas}
              placeholder="Contoh: ST-123/BLD/2026"
              value={field.state.value}
              aria-invalid={!field.state.meta.isValid}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>

      <form.Field name="kotaTujuan">
        {(field) => {
          const provinsi = provinsiOf(field.state.value);
          return (
            <Field data-invalid={!field.state.meta.isValid}>
              <FieldLabel htmlFor={field.name}>Kota tujuan</FieldLabel>
              <OptionSelect
                id={field.name}
                nemuId={NEMU_IDS.perdinForm.kotaTujuan}
                options={KOTA_OPTIONS}
                placeholder="Pilih kota tujuan"
                value={field.state.value}
                invalid={!field.state.meta.isValid}
                onChange={field.handleChange}
              />
              <FieldDescription>
                {provinsi ? `Provinsi: ${provinsi}` : "Provinsi terisi otomatis dari kota tujuan."}
              </FieldDescription>
              <FieldError errors={field.state.meta.errors} />
            </Field>
          );
        }}
      </form.Field>

      <form.Field name="maksud">
        {(field) => (
          <Field data-invalid={!field.state.meta.isValid}>
            <FieldLabel htmlFor={field.name}>Maksud perjalanan</FieldLabel>
            <Textarea
              id={field.name}
              name={field.name}
              data-nemu-id={NEMU_IDS.perdinForm.maksud}
              value={field.state.value}
              aria-invalid={!field.state.meta.isValid}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
    </PerdinFormSection>
  );
}
