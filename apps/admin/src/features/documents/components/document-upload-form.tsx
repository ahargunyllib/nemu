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

import { orpc } from "@/shared/api/orpc";

const ACCEPTED_FILES = ".pdf,.md,.markdown,application/pdf,text/markdown";

const uploadSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  version: z.string().trim().min(1, "Version is required"),
  isActive: z.boolean(),
  file: z
    .instanceof(File, { message: "Choose a PDF or Markdown file" })
    .nullable()
    .refine((file) => file !== null, "Choose a PDF or Markdown file")
    .refine(
      (file) => file === null || /\.(pdf|md|markdown)$/i.test(file.name),
      "Only PDF or Markdown (.md) files",
    ),
});

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.(pdf|md|markdown)$/i, "").replace(/[_-]+/g, " ");
}

export default function DocumentUploadForm({
  onUploaded,
  children,
}: {
  onUploaded?: () => void;
  children?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useMutation(orpc.uploadDocument.mutationOptions());

  const form = useForm({
    defaultValues: {
      title: "",
      version: "1.0",
      isActive: true,
      file: null as File | null,
    },
    validators: { onSubmit: uploadSchema },
    onSubmit: async ({ value, formApi }) => {
      if (!value.file) return;
      try {
        const document = await upload.mutateAsync({
          title: value.title,
          version: value.version,
          isActive: value.isActive,
          file: value.file,
        });
        if (document.status === "ready") {
          toast.success(`"${document.title}" uploaded`);
        } else {
          toast.error(`"${document.title}" failed: ${document.failureReason}`);
        }
        formApi.reset();
        if (fileInput.current) fileInput.current.value = "";
        onUploaded?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Upload failed");
      } finally {
        await queryClient.invalidateQueries({ queryKey: orpc.listDocuments.key() });
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
              accept={ACCEPTED_FILES}
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
              <Label htmlFor={field.name}>Title</Label>
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
              <Label htmlFor={field.name}>Version</Label>
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

      <form.Field name="isActive">
        {(field) => (
          <div className="flex items-center gap-2">
            <Switch
              id={field.name}
              checked={field.state.value}
              onCheckedChange={(checked) => field.handleChange(checked)}
            />
            <Label htmlFor={field.name}>Active</Label>
          </div>
        )}
      </form.Field>

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <div className="flex justify-end gap-2">
            {children}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner />}
              Upload
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
