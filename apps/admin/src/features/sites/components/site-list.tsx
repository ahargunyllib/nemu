import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@nemu/ui/components/alert-dialog";
import { Badge } from "@nemu/ui/components/badge";
import { Button } from "@nemu/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@nemu/ui/components/empty";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { Spinner } from "@nemu/ui/components/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nemu/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GlobeIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import SiteDialog from "@/features/sites/components/site-dialog";
import { permissionLabel } from "@/features/sites/lib/permissions";
import { orpc } from "@/shared/api/orpc";

const SKELETON_ROWS = ["a", "b", "c"];

/** WS-03: where the Nemu button appears, and what Nemu may do on each website. */
export default function SiteList() {
  const sites = useQuery(orpc.listAllowedSites.queryOptions());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Situs yang diizinkan</CardTitle>
        <CardDescription>
          {sites.data
            ? `${sites.data.length} situs. Ekstensi membaca daftar ini lagi paling lama tiap satu menit.`
            : "Situs tempat tombol Nemu muncul."}
        </CardDescription>
        <CardAction>
          <SiteDialog />
        </CardAction>
      </CardHeader>
      <CardContent>
        {sites.data?.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <GlobeIcon />
              </EmptyMedia>
              <EmptyTitle>Belum ada situs</EmptyTitle>
              <EmptyDescription>
                Tanpa situs di daftar, tombol Nemu tidak muncul di mana pun.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Alamat</TableHead>
                <TableHead>Yang boleh dilakukan Nemu</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.data
                ? sites.data.map((site) => (
                    <TableRow key={site.id}>
                      <TableCell className="font-medium">{site.label}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {site.pattern}
                      </TableCell>
                      <TableCell>
                        <Badge variant={site.permission === "read_fill" ? "default" : "secondary"}>
                          {permissionLabel(site.permission)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <SiteDialog site={site} />
                          <SiteDeleteButton id={site.id} label={site.label} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                : SKELETON_ROWS.map((key) => (
                    <TableRow key={key}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function SiteDeleteButton({ id, label }: { id: string; label: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const remove = useMutation(
    orpc.deleteAllowedSite.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        toast.success(`${label} dihapus dari daftar`);
      },
      onError: (error) => toast.error(error.message),
      onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.listAllowedSites.key() }),
    }),
  );

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Hapus ${label}`} />}
      >
        <Trash2Icon />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            Dalam satu menit tombol Nemu hilang dari situs ini untuk semua guru, dan Nemu tidak lagi
            membaca halamannya.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Batal</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate({ id })}
          >
            {remove.isPending && <Spinner />}
            Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
