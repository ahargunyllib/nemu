import { Button } from "@nemu/ui/components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@nemu/ui/components/field";
import { Input } from "@nemu/ui/components/input";
import { Spinner } from "@nemu/ui/components/spinner";
import { type FormEvent, useState } from "react";

type InstallCodeFormProps = {
  initialCode: string | null;
  pending: boolean;
  error: string | null;
  onSave: (code: string) => void;
};

/** The school install code, entered once by the operator (ADR-0015). */
export function InstallCodeForm({ initialCode, pending, error, onSave }: InstallCodeFormProps) {
  const [code, setCode] = useState(initialCode ?? "");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (code.trim()) onSave(code);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="install-code">Kode pemasangan sekolah</FieldLabel>
        <Input
          id="install-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Contoh: NEMU-SDITN-2026"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
        />
        <FieldDescription>
          Diisi sekali oleh operator sekolah. Kodenya dari Admin Javan.
        </FieldDescription>
        {error && <FieldError>{error}</FieldError>}
      </Field>
      <Button type="submit" disabled={pending || !code.trim()} className="self-start">
        {pending && <Spinner data-icon="inline-start" />}
        Simpan
      </Button>
    </form>
  );
}
