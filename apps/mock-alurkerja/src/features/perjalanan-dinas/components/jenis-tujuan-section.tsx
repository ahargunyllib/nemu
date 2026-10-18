import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { KOTA_TUJUAN } from "@nemu/contracts/process-instance";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@nemu/ui/components/field";
import { Input } from "@nemu/ui/components/input";
import { Textarea } from "@nemu/ui/components/textarea";

import OptionSelect from "@/features/perjalanan-dinas/components/option-select";
import type { AjukanPerdinForm } from "@/features/perjalanan-dinas/hooks/use-ajukan-perdin-form";
import { usePerdinErrors } from "@/features/perjalanan-dinas/hooks/use-perdin-errors";
import {
  DASAR_PENUGASAN_OPTIONS,
  JENIS_PERJALANAN_OPTIONS,
  kotaTujuanOf,
} from "@/features/perjalanan-dinas/lib/perdin-form";

export default function JenisTujuanSection({ form }: { form: AjukanPerdinForm }) {
  const errors = usePerdinErrors(form);

  return (
    <FieldGroup className="gap-3">
      <form.Field name="jenisPerjalanan">
        {(field) => {
          return (
            <Field data-invalid={Boolean(errors[field.name])} className="gap-1.5">
              <FieldLabel htmlFor={field.name}>Jenis perjalanan</FieldLabel>
              <OptionSelect
                id={field.name}
                nemuId={NEMU_IDS.perdinForm.jenisPerjalanan}
                options={JENIS_PERJALANAN_OPTIONS}
                placeholder="Pilih jenis perjalanan"
                value={field.state.value}
                invalid={Boolean(errors[field.name])}
                onChange={field.handleChange}
              />
              <FieldError>{errors[field.name]}</FieldError>
            </Field>
          );
        }}
      </form.Field>

      <form.Field name="kotaTujuan">
        {(field) => {
          const kota = kotaTujuanOf(field.state.value);
          return (
            <Field data-invalid={Boolean(errors[field.name])} className="gap-1.5">
              <FieldLabel htmlFor={field.name}>Kota tujuan</FieldLabel>
              <Input
                id={field.name}
                name={field.name}
                data-nemu-id={NEMU_IDS.perdinForm.kotaTujuan}
                placeholder="Contoh: Makassar"
                value={field.state.value}
                aria-invalid={Boolean(errors[field.name])}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              {kota && <FieldDescription>Provinsi: {KOTA_TUJUAN[kota]}</FieldDescription>}
              <FieldError>{errors[field.name]}</FieldError>
            </Field>
          );
        }}
      </form.Field>

      <form.Field name="dasarPenugasan">
        {(field) => {
          return (
            <Field data-invalid={Boolean(errors[field.name])} className="gap-1.5">
              <FieldLabel htmlFor={field.name}>Dasar penugasan (surat tugas)</FieldLabel>
              <OptionSelect
                id={field.name}
                nemuId={NEMU_IDS.perdinForm.dasarPenugasan}
                options={DASAR_PENUGASAN_OPTIONS}
                placeholder="Pilih surat tugas"
                value={field.state.value}
                invalid={Boolean(errors[field.name])}
                onChange={field.handleChange}
              />
              <FieldError>{errors[field.name]}</FieldError>
            </Field>
          );
        }}
      </form.Field>

      <form.Field name="maksud">
        {(field) => {
          return (
            <Field data-invalid={Boolean(errors[field.name])} className="gap-1.5">
              <FieldLabel htmlFor={field.name}>Maksud perjalanan</FieldLabel>
              <Textarea
                id={field.name}
                name={field.name}
                data-nemu-id={NEMU_IDS.perdinForm.maksud}
                value={field.state.value}
                aria-invalid={Boolean(errors[field.name])}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              <FieldError>{errors[field.name]}</FieldError>
            </Field>
          );
        }}
      </form.Field>
    </FieldGroup>
  );
}
