import { parseShortcut, shortcutKeys } from "@nemu/contracts/talk-shortcut";
import { Button } from "@nemu/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { caraLabel, fillSpeedSummary } from "@/features/settings/lib/options";
import { orpc } from "@/shared/api/orpc";

/** WS-08 at a glance beside the websites (F3-15): what every teacher of the school gets. */
export default function SettingsSummary({ workspaceId }: { workspaceId: string | undefined }) {
  const settings = useQuery(orpc.getSchoolSettings.queryOptions());
  const schools = useQuery(orpc.listSchools.queryOptions());
  const schoolName = schools.data?.find((school) => school.id === workspaceId)?.name;
  const shortcut = settings.data ? parseShortcut(settings.data.talkShortcut) : null;

  const rows = settings.data
    ? [
        {
          label: "Tombol bicara",
          value: `Tahan ${shortcut ? shortcutKeys(shortcut).join(" + ") : settings.data.talkShortcut}`,
        },
        { label: "Cara kerja bawaan", value: caraLabel(settings.data.defaultCara) },
        { label: "Kecepatan mengisi", value: fillSpeedSummary(settings.data.fillSpeed) },
      ]
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pengaturan Nemu</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/settings" />}>
            Ubah
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4">
          {rows
            ? rows.map((row) => (
                <div key={row.label} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="font-medium">{row.value}</dd>
                </div>
              ))
            : ["a", "b", "c"].map((key) => (
                <div key={key} className="flex justify-between gap-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
        </dl>
      </CardContent>
      <CardFooter className="text-muted-foreground">
        {schools.isPending ? (
          <Skeleton className="h-4 w-64" />
        ) : (
          `Berlaku untuk semua guru di ${schoolName ?? "sekolah ini"}.`
        )}
      </CardFooter>
    </Card>
  );
}
