import { cn } from "@nemu/ui/lib/utils";
import { CheckIcon, UploadIcon } from "lucide-react";

/**
 * One document on the task sheet: a dashed drop zone until it is uploaded, then a checked row with
 * its file name. With `onFile`, the whole row is the file input, so a click or a dropped file
 * uploads (again) and a highlight on its nemu_id rings the row.
 */
export default function DokumenUploadRow({
  label,
  nemuId,
  namaFile,
  disabled,
  onFile,
}: {
  label: string;
  nemuId: string;
  namaFile: string | undefined;
  disabled?: boolean;
  onFile?: (file: File) => void;
}) {
  return (
    <li
      className={cn(
        "relative flex items-center gap-3 rounded-2xl border px-4 py-3",
        !namaFile && "border-dashed",
        onFile &&
          "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 hover:bg-muted/50",
        disabled && "opacity-50",
      )}
    >
      {namaFile ? (
        <CheckIcon className="size-4 shrink-0 text-task-done" />
      ) : (
        <UploadIcon className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="font-medium">{label}</span>
      <span className="ml-auto truncate text-muted-foreground">
        {namaFile ?? "Drag file or click to upload"}
      </span>
      {onFile && (
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          data-nemu-id={nemuId}
          aria-label={`Unggah ${label.toLowerCase()}`}
          disabled={disabled}
          className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.target.value = "";
          }}
        />
      )}
    </li>
  );
}
