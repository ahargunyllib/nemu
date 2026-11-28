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
import { BookOpenIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import KamusDialog from "@/features/kamus/components/kamus-dialog";
import { fixerLabel } from "@/features/kamus/lib/fixers";
import { orpc } from "@/shared/api/orpc";

const SKELETON_ROWS = ["a", "b", "c"];

/** WS-05: the school's error dictionary, the only source of "ini kenapa?". */
export default function KamusList() {
  const kamus = useQuery(orpc.listKamus.queryOptions());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pesan error dan siapa yang memperbaiki</CardTitle>
        <CardDescription>
          Dipakai Nemu untuk menjelaskan error ke guru.
          {kamus.data && ` ${kamus.data.length} kendala.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {kamus.data?.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpenIcon />
              </EmptyMedia>
              <EmptyTitle>Kamus masih kosong</EmptyTitle>
              <EmptyDescription>
                Tambahkan pesan error satu per satu atau impor dari Excel.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aplikasi · pesan error</TableHead>
                <TableHead>Arti untuk guru</TableHead>
                <TableHead>Yang memperbaiki</TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">Ubah atau hapus</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kamus.data
                ? kamus.data.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-normal">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{entry.app || entry.code}</Badge>
                          {entry.app && (
                            <span className="text-xs text-muted-foreground">{entry.code}</span>
                          )}
                        </div>
                        <div className="mt-1">{entry.message}</div>
                      </TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">
                        {entry.meaning || "—"}
                      </TableCell>
                      <TableCell className="font-semibold">{fixerLabel(entry.fixer)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <KamusDialog entry={entry} />
                          <KamusDeleteButton id={entry.id} code={entry.code} />
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

function KamusDeleteButton({ id, code }: { id: string; code: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const remove = useMutation(
    orpc.deleteKamus.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        toast.success(`${code} dihapus`);
      },
      onError: (error) => toast.error(error.message),
      onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.listKamus.key() }),
    }),
  );

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Hapus ${code}`} />}
      >
        <Trash2Icon />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus {code}?</AlertDialogTitle>
          <AlertDialogDescription>
            Nemu tidak lagi bisa menjelaskan pesan error ini kepada guru.
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
