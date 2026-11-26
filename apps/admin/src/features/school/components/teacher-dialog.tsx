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
  HONORIFICS,
  type Honorific,
  formatPhone,
  splitList,
} from "@/features/school/lib/directory";
import type { Teacher } from "@/features/school/types/directory";
import { orpc } from "@/shared/api/orpc";

type Draft = {
  name: string;
  honorific: Honorific;
  nip: string;
  email: string;
  phone: string;
  classes: string;
  subjects: string;
};

function draftFrom(teacher?: Teacher): Draft {
  return {
    name: teacher?.name ?? "",
    honorific: teacher?.honorific ?? "Bu",
    nip: teacher?.nip ?? "",
    email: teacher?.email ?? "",
    phone: teacher ? formatPhone(teacher.phone) : "",
    classes: teacher?.classes.join(", ") ?? "",
    subjects: teacher?.subjects.join(", ") ?? "",
  };
}

/** Adds a teacher, or edits `teacher` when given: the fields the extension and WhatsApp match on. */
export default function TeacherDialog({ teacher }: { teacher?: Teacher }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => draftFrom(teacher));
  const queryClient = useQueryClient();
  const options = {
    onSuccess: () => {
      setOpen(false);
      toast.success(teacher ? `Data ${draft.name} disimpan` : `${draft.name} ditambahkan`);
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.listTeachers.key() }),
  };
  const create = useMutation(orpc.createTeacher.mutationOptions(options));
  const update = useMutation(orpc.updateTeacher.mutationOptions(options));
  const pending = create.isPending || update.isPending;
  const set = (field: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((current) => ({ ...current, [field]: event.target.value }));

  const input = {
    name: draft.name,
    honorific: draft.honorific,
    nip: draft.nip || undefined,
    email: draft.email.trim(),
    phone: draft.phone,
    classes: splitList(draft.classes),
    subjects: splitList(draft.subjects),
  };
  const incomplete =
    !input.name.trim() ||
    !input.email ||
    !input.phone.trim() ||
    input.classes.length === 0 ||
    input.subjects.length === 0;
  const id = teacher?.id ?? "new-teacher";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(draftFrom(teacher));
      }}
    >
      {teacher ? (
        <DialogTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Ubah ${teacher.name}`} />}
        >
          <PencilIcon />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <PlusIcon />
          Tambah guru
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{teacher ? "Ubah data guru" : "Tambah guru"}</DialogTitle>
          <DialogDescription>
            Nemu mengenali guru dari email akun AlurSekolah di ekstensi dan dari nomor WhatsApp saat
            mengirim foto.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (incomplete) return;
            if (teacher) update.mutate({ ...input, id: teacher.id });
            else create.mutate(input);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-[6rem_1fr]">
            <div className="grid gap-2">
              <Label htmlFor={`${id}-honorific`}>Sapaan</Label>
              <Select
                items={HONORIFICS.map((value) => ({ value, label: value }))}
                value={draft.honorific}
                onValueChange={(next) =>
                  next && setDraft((current) => ({ ...current, honorific: next }))
                }
              >
                <SelectTrigger id={`${id}-honorific`} className="w-full">
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
              <Label htmlFor={`${id}-name`}>Nama lengkap</Label>
              <Input
                id={`${id}-name`}
                placeholder="Siti Aminah, S.Pd."
                value={draft.name}
                onChange={set("name")}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`${id}-email`}>Email AlurSekolah</Label>
              <Input
                id={`${id}-email`}
                type="email"
                placeholder="nama@sekolah.sch.id"
                value={draft.email}
                onChange={set("email")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-phone`}>Nomor WhatsApp</Label>
              <Input
                id={`${id}-phone`}
                type="tel"
                placeholder="+62 812-0000-1001"
                value={draft.phone}
                onChange={set("phone")}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`${id}-classes`}>Kelas</Label>
              <Input
                id={`${id}-classes`}
                placeholder="4A, 4B"
                value={draft.classes}
                onChange={set("classes")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-nip`}>NIP (jika ada)</Label>
              <Input id={`${id}-nip`} inputMode="numeric" value={draft.nip} onChange={set("nip")} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-subjects`}>Mata pelajaran</Label>
            <Input
              id={`${id}-subjects`}
              placeholder="Matematika, Bahasa Indonesia"
              value={draft.subjects}
              onChange={set("subjects")}
            />
            <p className="text-sm text-muted-foreground">Pisahkan dengan koma.</p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Batal</DialogClose>
            <Button type="submit" disabled={pending || incomplete}>
              {pending && <Spinner />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
