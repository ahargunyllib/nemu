import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Field, FieldError, FieldGroup, FieldLabel } from "@nemu/ui/components/field";
import { Input } from "@nemu/ui/components/input";

import DatePicker from "@/features/perjalanan-dinas/components/date-picker";
import OptionSelect from "@/features/perjalanan-dinas/components/option-select";
import type { AjukanPerdinForm } from "@/features/perjalanan-dinas/hooks/use-ajukan-perdin-form";
import { usePerdinErrors } from "@/features/perjalanan-dinas/hooks/use-perdin-errors";
import { lamaPerjalanan, modaTransportOptions } from "@/features/perjalanan-dinas/lib/perdin-form";

export default function JadwalSection({ form }: { form: AjukanPerdinForm }) {
  const errors = usePerdinErrors(form);

  return (
    <FieldGroup>
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="tanggalBerangkat">
          {(field) => {
            return (
              <Field data-invalid={Boolean(errors[field.name])}>
                <FieldLabel htmlFor={field.name}>Tanggal berangkat</FieldLabel>
                <DatePicker
                  id={field.name}
                  nemuId={NEMU_IDS.perdinForm.tanggalBerangkat}
                  value={field.state.value}
                  invalid={Boolean(errors[field.name])}
                  onChange={field.handleChange}
                />
                <FieldError>{errors[field.name]}</FieldError>
              </Field>
            );
          }}
        </form.Field>

        <form.Subscribe selector={(state) => state.values.tanggalBerangkat}>
          {(tanggalBerangkat) => (
            <form.Field name="tanggalKembali">
              {(field) => {
                return (
                  <Field data-invalid={Boolean(errors[field.name])}>
                    <FieldLabel htmlFor={field.name}>Tanggal kembali</FieldLabel>
                    <DatePicker
                      id={field.name}
                      nemuId={NEMU_IDS.perdinForm.tanggalKembali}
                      value={field.state.value}
                      notBefore={tanggalBerangkat}
                      invalid={Boolean(errors[field.name])}
                      onChange={field.handleChange}
                    />
                    <FieldError>{errors[field.name]}</FieldError>
                  </Field>
                );
              }}
            </form.Field>
          )}
        </form.Subscribe>
      </div>

      <form.Subscribe
        selector={(state) =>
          lamaPerjalanan(state.values.tanggalBerangkat, state.values.tanggalKembali)
        }
      >
        {(lama) => (
          <Field>
            <FieldLabel htmlFor="lamaPerjalanan">Lama perjalanan</FieldLabel>
            <Input
              id="lamaPerjalanan"
              readOnly
              tabIndex={-1}
              placeholder="Terisi otomatis"
              value={lama ? `${lama.hari} hari · ${lama.malam} malam` : ""}
              className="bg-muted"
            />
          </Field>
        )}
      </form.Subscribe>

      <form.Subscribe selector={(state) => state.values.kotaTujuan}>
        {(kotaTujuan) => (
          <form.Field name="modaTransport">
            {(field) => {
              return (
                <Field data-invalid={Boolean(errors[field.name])}>
                  <FieldLabel htmlFor={field.name}>Moda transportasi</FieldLabel>
                  <OptionSelect
                    id={field.name}
                    nemuId={NEMU_IDS.perdinForm.modaTransport}
                    options={modaTransportOptions(kotaTujuan)}
                    placeholder="Pilih moda"
                    value={field.state.value}
                    invalid={Boolean(errors[field.name])}
                    onChange={field.handleChange}
                  />
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
