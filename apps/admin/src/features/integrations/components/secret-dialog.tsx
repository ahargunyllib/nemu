import { Button } from "@nemu/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@nemu/ui/components/dialog";
import { Input } from "@nemu/ui/components/input";
import { Label } from "@nemu/ui/components/label";
import { Spinner } from "@nemu/ui/components/spinner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import type { SettingField } from "@/features/integrations/lib/settings";
import { orpc } from "@/shared/api/orpc";

/** Sets or replaces one WS-07 value. The field starts empty: a stored value is never shown. */
export default function SecretDialog({ field, isSet }: { field: SettingField; isSet: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const queryClient = useQueryClient();
  const save = useMutation(
    orpc.saveIntegrationSecret.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        toast.success(`${field.label} disimpan`);
      },
      onError: (error) => toast.error(error.message),
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: orpc.listIntegrationSecrets.key() }),
    }),
  );
  const id = `secret-${field.name}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValue("");
      }}
    >
      <DialogTrigger
        render={<Button variant="outline" size="sm" aria-label={`Ganti ${field.label}`} />}
      >
        {isSet ? "Ganti" : "Isi"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isSet ? "Ganti" : "Isi"} {field.label}
          </DialogTitle>
          <DialogDescription>
            {isSet ? "Nilai lama diganti. " : ""}Setelah disimpan, nilainya tidak bisa dilihat lagi;
            yang tampil hanya 4 karakter terakhir.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (value.trim()) save.mutate({ name: field.name, value });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor={id}>{field.label}</Label>
            <Input
              id={id}
              type={field.inputType}
              autoComplete="off"
              spellCheck={false}
              placeholder={field.placeholder}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <p className="text-muted-foreground">{field.description}</p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Batal</DialogClose>
            <Button type="submit" disabled={save.isPending || !value.trim()}>
              {save.isPending && <Spinner />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
