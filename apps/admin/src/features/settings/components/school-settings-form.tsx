import type { Cara, FillSpeed, SchoolSettings } from "@nemu/contracts/extension";
import { FILL_INTERVAL_MS } from "@nemu/contracts/extension";
import { parseShortcut, shortcutKeys } from "@nemu/contracts/talk-shortcut";
import { Button } from "@nemu/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { Input } from "@nemu/ui/components/input";
import { Kbd, KbdGroup } from "@nemu/ui/components/kbd";
import { Label } from "@nemu/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@nemu/ui/components/radio-group";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { Spinner } from "@nemu/ui/components/spinner";
import { ToggleGroup, ToggleGroupItem } from "@nemu/ui/components/toggle-group";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { CARA_OPTIONS, FILL_SPEED_OPTIONS } from "@/features/settings/lib/options";
import { orpc } from "@/shared/api/orpc";

/** WS-08: how Nemu works for every teacher of the school; the extension follows within a minute. */
export default function SchoolSettingsForm() {
  const settings = useQuery(orpc.getSchoolSettings.queryOptions());
  if (!settings.data) return <SchoolSettingsSkeleton />;
  return <SettingsCard initial={settings.data} />;
}

function SettingsCard({ initial }: { initial: SchoolSettings }) {
  const [talkShortcut, setTalkShortcut] = useState(initial.talkShortcut);
  const [defaultCara, setDefaultCara] = useState<Cara>(initial.defaultCara);
  const [fillSpeed, setFillSpeed] = useState<FillSpeed>(initial.fillSpeed);
  const queryClient = useQueryClient();
  const save = useMutation(
    orpc.saveSchoolSettings.mutationOptions({
      onSuccess: (saved) => {
        setTalkShortcut(saved.talkShortcut);
        toast.success("Pengaturan disimpan. Semua guru memakainya dalam satu menit.");
      },
      onError: (error) => toast.error(error.message),
      onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.getSchoolSettings.key() }),
    }),
  );
  const shortcut = parseShortcut(talkShortcut);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cara Nemu bekerja</CardTitle>
        <CardDescription>Berlaku untuk semua guru sekolah ini.</CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (shortcut) save.mutate({ talkShortcut, defaultCara, fillSpeed });
        }}
      >
        <CardContent className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="talk-shortcut">Tombol bicara</Label>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                id="talk-shortcut"
                className="max-w-56"
                value={talkShortcut}
                aria-invalid={!shortcut}
                onChange={(event) => setTalkShortcut(event.target.value)}
              />
              {shortcut && (
                <KbdGroup>
                  {shortcutKeys(shortcut).map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </KbdGroup>
              )}
            </div>
            <p className="text-muted-foreground">
              {shortcut
                ? "Guru menahan kombinasi ini untuk berbicara dengan Nemu."
                : "Tulis satu tombol pengubah (Ctrl, Alt, Shift) dan satu huruf, angka, atau Spasi, misalnya Ctrl+Space."}
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Cara bawaan</Label>
            <RadioGroup
              value={defaultCara}
              onValueChange={(value) => setDefaultCara(value as Cara)}
            >
              {CARA_OPTIONS.map((option) => (
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

          <div className="grid gap-2">
            <Label>Kecepatan mengisi (cara 1)</Label>
            <ToggleGroup
              variant="outline"
              value={[fillSpeed]}
              onValueChange={(value) => {
                const next = value[0] as FillSpeed | undefined;
                if (next) setFillSpeed(next);
              }}
            >
              {FILL_SPEED_OPTIONS.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value}>
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-muted-foreground">
              Satu kolom tiap {FILL_INTERVAL_MS[fillSpeed] / 1000} detik. Guru tetap bisa bilang
              "pelan" saat Nemu mengisi.
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={save.isPending || !shortcut}>
            {save.isPending && <Spinner />}
            Simpan
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function SchoolSettingsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="grid gap-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-9 w-64" />
      </CardContent>
    </Card>
  );
}
