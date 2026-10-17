import { Badge } from "@nemu/ui/components/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";

import { formatTanggal } from "@/shared/lib/format-tanggal";
import type { ProcessInstanceView } from "@/features/perjalanan-dinas/types/process-instance-view";

export default function TaskSummary({ instance }: { instance: ProcessInstanceView }) {
  const rows = [
    ["ID tugas", instance.activeTask?.id ?? "–"],
    ["Nomor pengajuan", instance.id],
    ["Tujuan", `${instance.kotaTujuan}, ${instance.provinsi}`],
    ["Tanggal berangkat", formatTanggal(instance.tanggalBerangkat)],
    ["Tanggal kembali", formatTanggal(instance.tanggalKembali)],
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{instance.activeTask?.label ?? "Tidak ada tugas aktif"}</CardTitle>
        <CardDescription>Perjalanan Dinas ke {instance.kotaTujuan}</CardDescription>
        <CardAction>
          <Badge variant="secondary">{instance.state}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
