import { Button } from "@nemu/ui/components/button";
import { Input } from "@nemu/ui/components/input";
import { Label } from "@nemu/ui/components/label";
import { Spinner } from "@nemu/ui/components/spinner";
import { Switch } from "@nemu/ui/components/switch";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useRef } from "react";
import { toast } from "sonner";
import z from "zod";

import type { DocumentScope } from "@/features/documents/api/list-documents";
import SiteChecklist from "@/features/documents/components/site-checklist";
import {
  UPLOAD_KINDS,
  type UploadKind,
  type UploadKindConfig,
} from "@/features/documents/lib/upload-kinds";
import { invalidateKnowledge } from "@/features/documents/api/invalidate-knowledge";
import { orpc } from "@/shared/api/orpc";

function uploadSchema({ pattern, missing, wrong }: UploadKindConfig) {
  return z.object({
    title: z.string().trim().min(1, "Judul wajib diisi"),
    version: z.string().trim().min(1, "Versi wajib diisi"),
    isActive: z.boolean(),
    siteIds: z.array(z.string()),
    file: z
      .instanceof(File, { message: missing })
      .nullable()
      .refine((file) => file !== null, missing)
      .refine((file) => file === null || pattern.test(file.name), wrong),
  });
}

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.(pdf|md|markdown|bpmn)$/i, "").replace(/[_-]+/g, " ");
}

/**
 * Uploads a PDF, Markdown or BPMN (or only the files `kind` takes), new or as the next version of
 * an existing title (WS-04).
 */
export default function DocumentUploadForm({
  packageId,
  kind = "any",
  initialTitle = "",
  onUploaded,
  children,
}: {
  packageId: DocumentScope;
  kind?: UploadKind;
  initialTitle?: string;
  onUploaded?: () => void;
  children?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useMutation(orpc.uploadDocument.mutationOptions());
  const files = UPLOAD_KINDS[kind];

  const form = useForm({
    defaultValues: {
      title: initialTitle,
      version: initialTitle ? "" : "1.0",
      // A new version starts inactive, so it can be tried in Uji jawaban first.
      isActive: !initialTitle,
      siteIds: [] as string[],
      file: null as File | null,
    },
    validators: { onSubmit: uploadSchema(files) },
    onSubmit: async ({ value, formApi }) => {
      if (!value.file) return;
      try {
        const document = await upload.mutateAsync({ ...value, file: value.file, packageId });
        if (document.status === "ready") toast.success(`"${document.title}" diunggah`);
        else toast.error(`"${document.title}" gagal: ${document.failureReason}`);
        formApi.reset();
        if (fileInput.current) fileInput.current.value = "";
        onUploaded?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal mengunggah");
      } finally {
        await invalidateKnowledge(queryClient);
      }
    },
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field name="file">
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={field.name}>File</Label>
            <Input
              ref={fileInput}
              id={field.name}
              name={field.name}
              type="file"
              accept={files.accept}
              onBlur={field.handleBlur}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                field.handleChange(file);
                if (file && !form.getFieldValue("title")) {
                  form.setFieldValue("title", titleFromFileName(file.name));
                }
              }}
            />
            <FieldErrors errors={field.state.meta.errors} />
          </div>
        )}
      </form.Field>

      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <form.Field name="title">
          {(field) => (
            <div className="grid gap-2">
              <Label htmlFor={field.name}>Judul</Label>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              <FieldErrors errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>
        <form.Field name="version">
          {(field) => (
            <div className="grid gap-2">
              <Label htmlFor={field.name}>Versi</Label>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              <FieldErrors errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name="siteIds">
        {(field) => (
          <div className="grid gap-2">
            <Label>Berlaku di situs</Label>
            <SiteChecklist value={field.state.value} onChange={field.handleChange} />
            <p className="text-muted-foreground">Tidak dicentang berarti berlaku di semua situs.</p>
          </div>
        )}
      </form.Field>

      <form.Field name="isActive">
        {(field) => (
          <div className="flex items-center gap-2">
            <Switch
              id={field.name}
              checked={field.state.value}
              onCheckedChange={(checked) => field.handleChange(checked)}
            />
            <Label htmlFor={field.name}>Langsung aktif</Label>
          </div>
        )}
      </form.Field>

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <div className="flex justify-end gap-2">
            {children}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner />}
              Unggah
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}

function FieldErrors({ errors }: { errors: Array<{ message?: string } | undefined> }) {
  return errors.map((error) => (
    <p key={error?.message} className="text-sm text-destructive">
      {error?.message}
    </p>
  ));
}
