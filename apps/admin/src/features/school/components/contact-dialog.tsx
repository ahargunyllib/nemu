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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nemu/ui/components/select";
import { Spinner } from "@nemu/ui/components/spinner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  type ContactRole,
  HONORIFICS,
  type Honorific,
  formatPhone,
} from "@/features/school/lib/directory";
import type { Contact } from "@/features/school/types/directory";
import { orpc } from "@/shared/api/orpc";

/** Fills in or changes the school's contact for one role. */
export default function ContactDialog({
  role,
  label,
  contact,
}: {
  role: ContactRole;
  label: string;
  contact?: Contact;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [honorific, setHonorific] = useState<Honorific>("Pak");
  const [phone, setPhone] = useState("");
  const queryClient = useQueryClient();
  const save = useMutation(
    orpc.saveContact.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        toast.success(`Kontak ${label.toLowerCase()} disimpan`);
      },
      onError: (error) => toast.error(error.message),
      onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.listContacts.key() }),
    }),
  );
  const incomplete = !name.trim() || !phone.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName(contact?.name ?? "");
          setHonorific(contact?.honorific ?? "Pak");
          setPhone(contact ? formatPhone(contact.phone) : "");
        }
      }}
    >
      {contact ? (
        <DialogTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Ubah kontak ${label}`} />}
        >
          <PencilIcon />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          <PlusIcon />
          Isi kontak
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kontak {label.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Nemu menyebut nama ini saat guru menemui kendala yang perlu diselesaikan{" "}
            {label.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!incomplete) save.mutate({ role, name, honorific, phone });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-[6rem_1fr]">
            <div className="grid gap-2">
              <Label htmlFor={`${role}-honorific`}>Sapaan</Label>
              <Select
                items={HONORIFICS.map((value) => ({ value, label: value }))}
                value={honorific}
                onValueChange={(next) => next && setHonorific(next)}
              >
                <SelectTrigger id={`${role}-honorific`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HONORIFICS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${role}-name`}>Nama lengkap</Label>
              <Input id={`${role}-name`} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${role}-phone`}>Nomor WhatsApp</Label>
            <Input
              id={`${role}-phone`}
              type="tel"
              placeholder="+62 812-0000-1003"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Batal</DialogClose>
            <Button type="submit" disabled={save.isPending || incomplete}>
              {save.isPending && <Spinner />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
