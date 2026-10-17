import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { MODA_TRANSPORT } from "@nemu/contracts/process-instance";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@nemu/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@nemu/ui/components/radio-group";

import OptionSelect from "@/features/perjalanan-dinas/components/option-select";
import PerdinFormSection from "@/features/perjalanan-dinas/components/perdin-form-section";
import RupiahInput from "@/features/perjalanan-dinas/components/rupiah-input";
import type { AjukanPerdinForm } from "@/features/perjalanan-dinas/hooks/use-ajukan-perdin-form";

const PENGINAPAN_OPTIONS = [
  { value: "hotel", label: "Menginap di hotel", nemuId: NEMU_IDS.perdinForm.lodgingHotel },
  {
    value: "tidak_hotel",
    label: "Tidak menginap di hotel",
    nemuId: NEMU_IDS.perdinForm.lodgingNotHotel,
  },
] as const;

export default function BiayaSection({ form }: { form: AjukanPerdinForm }) {
  return (
    <PerdinFormSection title="C. Biaya">
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="modaTransport">
          {(field) => (
            <Field data-invalid={!field.state.meta.isValid}>
              <FieldLabel htmlFor={field.name}>Moda transportasi</FieldLabel>
              <OptionSelect
                id={field.name}
                nemuId={NEMU_IDS.perdinForm.modaTransport}
                options={MODA_TRANSPORT}
                placeholder="Pilih moda"
                value={field.state.value}
                invalid={!field.state.meta.isValid}
                onChange={field.handleChange}
              />
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>

        <form.Field name="biayaTransport">
          {(field) => (
            <Field data-invalid={!field.state.meta.isValid}>
              <FieldLabel id={`${field.name}-label`} htmlFor={field.name}>
                Biaya transportasi pergi-pulang
              </FieldLabel>
              <RupiahInput
                id={field.name}
                name={field.name}
                nemuId={NEMU_IDS.perdinForm.biayaTransport}
                labelId={`${field.name}-label`}
                value={field.state.value}
                aria-invalid={!field.state.meta.isValid}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      </div>

      <form.Field name="penginapan">
        {(field) => (
          <FieldSet data-invalid={!field.state.meta.isValid}>
            <FieldLegend variant="label">Penginapan</FieldLegend>
            <RadioGroup
              name={field.name}
              value={field.state.value || null}
              onValueChange={(value) => field.handleChange(String(value))}
            >
              {PENGINAPAN_OPTIONS.map((option) => (
                <Field key={option.value} orientation="horizontal">
                  <RadioGroupItem
                    id={`penginapan-${option.value}`}
                    value={option.value}
                    data-nemu-id={option.nemuId}
                    aria-invalid={!field.state.meta.isValid}
                  />
                  <FieldLabel htmlFor={`penginapan-${option.value}`} className="font-normal">
                    {option.label}
                  </FieldLabel>
                </Field>
              ))}
            </RadioGroup>
            <FieldError errors={field.state.meta.errors} />
          </FieldSet>
        )}
      </form.Field>

      <form.Field name="nominalPenginapan">
        {(field) => (
          <Field data-invalid={!field.state.meta.isValid}>
            <FieldLabel id={`${field.name}-label`} htmlFor={field.name}>
              Nominal penginapan
            </FieldLabel>
            <RupiahInput
              id={field.name}
              name={field.name}
              nemuId={NEMU_IDS.perdinForm.lodgingAmount}
              labelId={`${field.name}-label`}
              value={field.state.value}
              aria-invalid={!field.state.meta.isValid}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <FieldDescription>Total biaya penginapan selama perjalanan.</FieldDescription>
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>

      <form.Field name="uangHarian">
        {(field) => (
          <Field data-invalid={!field.state.meta.isValid}>
            <FieldLabel id={`${field.name}-label`} htmlFor={field.name}>
              Uang harian
            </FieldLabel>
            <RupiahInput
              id={field.name}
              name={field.name}
              nemuId={NEMU_IDS.perdinForm.uangHarian}
              labelId={`${field.name}-label`}
              value={field.state.value}
              aria-invalid={!field.state.meta.isValid}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <FieldDescription>Total uang harian untuk seluruh hari perjalanan.</FieldDescription>
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
    </PerdinFormSection>
  );
}
