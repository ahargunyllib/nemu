import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@nemu/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@nemu/ui/components/radio-group";

import RupiahInput from "@/features/perjalanan-dinas/components/rupiah-input";
import type { AjukanPerdinForm } from "@/features/perjalanan-dinas/hooks/use-ajukan-perdin-form";
import { usePerdinErrors } from "@/features/perjalanan-dinas/hooks/use-perdin-errors";
import {
  biayaTransportLabel,
  formatRupiah,
  lamaPerjalanan,
  uangHarianPerHari,
} from "@/features/perjalanan-dinas/lib/perdin-form";

const PENGINAPAN_OPTIONS = [
  {
    value: "hotel",
    label: "Menginap di hotel",
    description: "Dibayar sesuai bukti, maksimal tarif SBM",
    nemuId: NEMU_IDS.perdinForm.lodgingHotel,
  },
  {
    value: "tidak_hotel",
    label: "Tidak menginap di hotel",
    description: "Diganti 30% tarif hotel per malam",
    nemuId: NEMU_IDS.perdinForm.lodgingNotHotel,
  },
] as const;

export default function BiayaSection({ form }: { form: AjukanPerdinForm }) {
  const errors = usePerdinErrors(form);

  return (
    <FieldGroup className="gap-3">
      <form.Subscribe
        selector={(state) =>
          biayaTransportLabel(state.values.modaTransport, state.values.kotaTujuan)
        }
      >
        {(label) => (
          <form.Field name="biayaTransport">
            {(field) => {
              return (
                <Field data-invalid={Boolean(errors[field.name])} className="gap-1.5">
                  <FieldLabel id={`${field.name}-label`} htmlFor={field.name}>
                    {label}
                  </FieldLabel>
                  <RupiahInput
                    id={field.name}
                    name={field.name}
                    nemuId={NEMU_IDS.perdinForm.biayaTransport}
                    labelId={`${field.name}-label`}
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
        )}
      </form.Subscribe>

      <form.Field name="penginapan">
        {(field) => {
          return (
            <FieldSet data-invalid={Boolean(errors[field.name])} className="gap-1.5">
              <FieldLegend variant="label">Penginapan</FieldLegend>
              <RadioGroup
                name={field.name}
                className="gap-1.5"
                value={field.state.value || null}
                onValueChange={(value) => field.handleChange(String(value))}
              >
                {PENGINAPAN_OPTIONS.map((option) => (
                  // The nemu_id rings the whole card Rina sees, not only its radio dot.
                  <FieldLabel
                    key={option.value}
                    htmlFor={`penginapan-${option.value}`}
                    data-nemu-id={option.nemuId}
                    className="*:data-[slot=field]:px-3 *:data-[slot=field]:py-2.5"
                  >
                    <Field orientation="horizontal">
                      <RadioGroupItem
                        id={`penginapan-${option.value}`}
                        value={option.value}
                        aria-invalid={Boolean(errors[field.name])}
                      />
                      <FieldContent>
                        <FieldTitle>{option.label}</FieldTitle>
                        <FieldDescription>{option.description}</FieldDescription>
                      </FieldContent>
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
              <FieldError>{errors[field.name]}</FieldError>
            </FieldSet>
          );
        }}
      </form.Field>

      <form.Field name="nominalPenginapan">
        {(field) => {
          return (
            <Field data-invalid={Boolean(errors[field.name])} className="gap-1.5">
              <FieldLabel id={`${field.name}-label`} htmlFor={field.name}>
                Nominal penginapan
              </FieldLabel>
              <RupiahInput
                id={field.name}
                name={field.name}
                nemuId={NEMU_IDS.perdinForm.lodgingAmount}
                labelId={`${field.name}-label`}
                value={field.state.value}
                aria-invalid={Boolean(errors[field.name])}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              <FieldDescription>Total biaya penginapan selama perjalanan.</FieldDescription>
              <FieldError>{errors[field.name]}</FieldError>
            </Field>
          );
        }}
      </form.Field>

      <form.Subscribe
        selector={({ values }) => ({
          hari: lamaPerjalanan(values.tanggalBerangkat, values.tanggalKembali)?.hari,
          perHari: uangHarianPerHari(values.jenisPerjalanan, values.kotaTujuan),
        })}
      >
        {({ hari, perHari }) => (
          <form.Field name="uangHarian">
            {(field) => {
              return (
                <Field data-invalid={Boolean(errors[field.name])} className="gap-1.5">
                  <FieldLabel id={`${field.name}-label`} htmlFor={field.name}>
                    {hari ? `Uang harian · ${hari} hari` : "Uang harian"}
                  </FieldLabel>
                  <RupiahInput
                    id={field.name}
                    name={field.name}
                    nemuId={NEMU_IDS.perdinForm.uangHarian}
                    labelId={`${field.name}-label`}
                    value={field.state.value}
                    aria-invalid={Boolean(errors[field.name])}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  <FieldDescription>
                    {hari && perHari
                      ? `${formatRupiah(perHari)} × ${hari} hari`
                      : "Total uang harian untuk seluruh hari perjalanan."}
                  </FieldDescription>
                  <FieldError>{errors[field.name]}</FieldError>
                </Field>
              );
            }}
          </form.Field>
        )}
      </form.Subscribe>
    </FieldGroup>
  );
}
