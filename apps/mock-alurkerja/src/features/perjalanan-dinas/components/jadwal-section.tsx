import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Field, FieldDescription, FieldError, FieldLabel } from "@nemu/ui/components/field";
import { Input } from "@nemu/ui/components/input";

import PerdinFormSection from "@/features/perjalanan-dinas/components/perdin-form-section";
import type { AjukanPerdinForm } from "@/features/perjalanan-dinas/hooks/use-ajukan-perdin-form";
import { lamaPerjalanan } from "@/features/perjalanan-dinas/lib/perdin-form";

const DATE_FIELDS = [
  {
    name: "tanggalBerangkat",
    label: "Tanggal berangkat",
    nemuId: NEMU_IDS.perdinForm.tanggalBerangkat,
  },
  { name: "tanggalKembali", label: "Tanggal kembali", nemuId: NEMU_IDS.perdinForm.tanggalKembali },
] as const;

export default function JadwalSection({ form }: { form: AjukanPerdinForm }) {
  return (
    <PerdinFormSection title="B. Jadwal">
      <div className="grid gap-4 sm:grid-cols-2">
        {DATE_FIELDS.map(({ name, label, nemuId }) => (
          <form.Field key={name} name={name}>
            {(field) => (
              <Field data-invalid={!field.state.meta.isValid}>
                <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="date"
                  data-nemu-id={nemuId}
                  value={field.state.value}
                  aria-invalid={!field.state.meta.isValid}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        ))}
      </div>
      <form.Subscribe
        selector={(state) =>
          lamaPerjalanan(state.values.tanggalBerangkat, state.values.tanggalKembali)
        }
      >
        {(lama) => (
          <FieldDescription>
            {lama
              ? `Lama perjalanan: ${lama.hari} hari, ${lama.malam} malam.`
              : "Jumlah hari dihitung otomatis dari tanggal berangkat dan kembali."}
          </FieldDescription>
        )}
      </form.Subscribe>
    </PerdinFormSection>
  );
}
