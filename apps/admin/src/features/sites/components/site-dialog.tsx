import type { SitePermission } from "@nemu/contracts/extension";
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
import { RadioGroup, RadioGroupItem } from "@nemu/ui/components/radio-group";
import { Spinner } from "@nemu/ui/components/spinner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SITE_PERMISSIONS } from "@/features/sites/lib/permissions";
import { orpc } from "@/shared/api/orpc";

type Site = { id: string; pattern: string; label: string; permission: SitePermission };

/** Adds a website to the school's list, or changes one, with what Nemu may do there. */
export default function SiteDialog({ site }: { site?: Site }) {
  const [open, setOpen] = useState(false);
  const [pattern, setPattern] = useState("");
  const [label, setLabel] = useState("");
  const [permission, setPermission] = useState<SitePermission>("read_fill");
  const queryClient = useQueryClient();
  const save = useMutation(
    orpc.saveAllowedSite.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        toast.success("Website disimpan. Ekstensi mengikutinya dalam satu menit.");
      },
      onError: (error) => toast.error(error.message),
      onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.listAllowedSites.key() }),
    }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setPattern(site?.pattern ?? "");
          setLabel(site?.label ?? "");
          setPermission(site?.permission ?? "read_fill");
        }
      }}
    >
      {site ? (
        <DialogTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Ubah ${site.label}`} />}
        >
          <PencilIcon />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <PlusIcon />
          Tambah website
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{site ? "Ubah website" : "Tambah website"}</DialogTitle>
          <DialogDescription>
            Tombol Nemu hanya muncul di website pada daftar ini. Di website lain Nemu tidak membaca
            apa pun.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (pattern.trim()) save.mutate({ id: site?.id ?? null, pattern, label, permission });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="site-pattern">Alamat website</Label>
            <Input
              id="site-pattern"
              placeholder="portal.sekolah.sch.id atau *.alursekolah.id"
              value={pattern}
              onChange={(event) => setPattern(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="site-label">Nama</Label>
            <Input
              id="site-label"
              placeholder="Portal Dinas"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Yang boleh dilakukan Nemu</Label>
            <RadioGroup
              value={permission}
              onValueChange={(value) => setPermission(value as SitePermission)}
            >
              {SITE_PERMISSIONS.map((option) => (
                <Label
                  key={option.value}
                  className="flex items-start gap-3 rounded-2xl border p-3 font-normal"
                >
                  <RadioGroupItem value={option.value} className="mt-0.5" />
                  <span className="grid gap-1">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-muted-foreground">{option.description}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Batal</DialogClose>
            <Button type="submit" disabled={save.isPending || !pattern.trim()}>
              {save.isPending && <Spinner />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
