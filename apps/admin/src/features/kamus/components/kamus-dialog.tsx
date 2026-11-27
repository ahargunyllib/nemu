import { Button } from "@nemu/ui/components/button";
import { Checkbox } from "@nemu/ui/components/checkbox";
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
import { Textarea } from "@nemu/ui/components/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { type Fixer, FIXERS } from "@/features/kamus/lib/fixers";
import { orpc } from "@/shared/api/orpc";

export type KamusEntry = {
  id: string;
  code: string;
  app: string;
  message: string;
  meaning: string;
  teacherFault: boolean;
  fixer: Fixer;
  fix: string;
};

type KamusFields = Omit<KamusEntry, "id">;

const EMPTY: KamusFields = {
  code: "",
  app: "AlurSekolah",
  message: "",
  meaning: "",
  teacherFault: false,
  fixer: "operator",
  fix: "",
};

function fieldsOf({ code, app, message, meaning, teacherFault, fixer, fix }: KamusFields) {
  return { code, app, message, meaning, teacherFault, fixer, fix };
}

/** Adds a Kamus Kendala row by hand, or changes one. */
export default function KamusDialog({
  entry,
  nextCode,
}: {
  entry?: KamusEntry;
  nextCode?: string;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<KamusFields>(EMPTY);
  const queryClient = useQueryClient();
  const onSuccess = () => {
    setOpen(false);
    toast.success("Entri kamus disimpan");
  };
  const options = {
    onSuccess,
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.listKamus.key() }),
  };
  const create = useMutation(orpc.createKamus.mutationOptions(options));
  const update = useMutation(orpc.updateKamus.mutationOptions(options));
  const pending = create.isPending || update.isPending;
  const incomplete = !values.code.trim() || !values.message.trim() || !values.fix.trim();
  const set = <K extends keyof KamusFields>(key: K, value: KamusFields[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValues(entry ? fieldsOf(entry) : { ...EMPTY, code: nextCode ?? "" });
      }}
    >
      {entry ? (
        <DialogTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Ubah ${entry.code}`} />}
        >
          <PencilIcon />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <PlusIcon />
          Tambah entri
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? `Ubah ${entry.code}` : "Tambah entri kamus"}</DialogTitle>
          <DialogDescription>
            Nemu menjawab "ini kenapa?" hanya dari kamus ini. Tulis pesan error persis seperti di
            layar.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (incomplete) return;
            if (entry) update.mutate({ ...values, id: entry.id });
            else create.mutate(values);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
            <div className="grid gap-2">
              <Label htmlFor="kamus-code">Kode</Label>
              <Input
                id="kamus-code"
                value={values.code}
                onChange={(event) => set("code", event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kamus-app">Aplikasi</Label>
              <Input
                id="kamus-app"
                value={values.app}
                onChange={(event) => set("app", event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="kamus-message">Pesan error</Label>
            <Textarea
              id="kamus-message"
              value={values.message}
              onChange={(event) => set("message", event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="kamus-meaning">Artinya</Label>
            <Textarea
              id="kamus-meaning"
              value={values.meaning}
              onChange={(event) => set("meaning", event.target.value)}
            />
          </div>
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox
              checked={values.teacherFault}
              onCheckedChange={(checked) => set("teacherFault", checked)}
            />
            Kesalahan guru
          </Label>
          <div className="grid gap-2">
            <Label htmlFor="kamus-fixer">Yang memperbaiki</Label>
            <Select
              items={FIXERS.map(({ value, label }) => ({ value, label }))}
              value={values.fixer}
              onValueChange={(next) => next && set("fixer", next)}
            >
              <SelectTrigger id="kamus-fixer" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIXERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="kamus-fix">Yang dilakukan</Label>
            <Textarea
              id="kamus-fix"
              placeholder="Operator sekolah perlu memetakan mata pelajaran di menu Pengaturan Kelas."
              value={values.fix}
              onChange={(event) => set("fix", event.target.value)}
            />
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
