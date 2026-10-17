import { Badge } from "@nemu/ui/components/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@nemu/ui/components/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nemu/ui/components/table";

import {
  type ProcessInstance,
  formatTanggal,
} from "@/features/perjalanan-dinas/lib/demo-process-instances";

export default function RequestTable({ instances }: { instances: readonly ProcessInstance[] }) {
  if (instances.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Belum ada pengajuan</EmptyTitle>
          <EmptyDescription>Buat pengajuan lewat menu Ajukan Perjalanan Dinas.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nomor</TableHead>
          <TableHead>Tujuan</TableHead>
          <TableHead>Tanggal</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {instances.map((instance) => (
          <TableRow key={instance.id}>
            <TableCell className="font-medium">{instance.id}</TableCell>
            <TableCell>
              {instance.tujuan}, {instance.provinsi}
            </TableCell>
            <TableCell>
              {formatTanggal(instance.tanggalBerangkat)} – {formatTanggal(instance.tanggalKembali)}
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{instance.state}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
