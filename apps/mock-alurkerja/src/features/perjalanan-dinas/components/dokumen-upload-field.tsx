import { Badge } from "@nemu/ui/components/badge";
import { Field, FieldDescription, FieldLabel } from "@nemu/ui/components/field";
import { Input } from "@nemu/ui/components/input";

export default function DokumenUploadField({
  id,
  label,
  nemuId,
  namaFile,
  disabled,
  onFile,
}: {
  id: string;
  label: string;
  nemuId: string;
  namaFile: string | undefined;
  disabled: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <Field>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Badge variant={namaFile ? "secondary" : "destructive"}>
          {namaFile ? "Terunggah" : "Belum diunggah"}
        </Badge>
      </div>
      <Input
        id={id}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        data-nemu-id={nemuId}
        aria-label={`Unggah ${label.toLowerCase()}`}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
      <FieldDescription>{namaFile ?? "PDF atau gambar."}</FieldDescription>
    </Field>
  );
}
