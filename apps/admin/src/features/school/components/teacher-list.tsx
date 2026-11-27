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
import { Trash2Icon, UsersIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import TeacherDialog from "@/features/school/components/teacher-dialog";
import { formatPhone } from "@/features/school/lib/directory";
import type { Teacher } from "@/features/school/types/directory";
import { orpc } from "@/shared/api/orpc";

const SKELETON_ROWS = ["a", "b", "c"];

/** WS-06: the school's teachers, who Nemu recognises in the extension and on WhatsApp. */
export default function TeacherList() {
  const teachers = useQuery(orpc.listTeachers.queryOptions());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Guru</CardTitle>
        <CardDescription>
          {teachers.data
            ? `${teachers.data.length} guru terdaftar`
            : "Guru yang dikenali Nemu di ekstensi dan di WhatsApp."}
        </CardDescription>
        <CardAction>
          <TeacherDialog />
        </CardAction>
      </CardHeader>
      <CardContent>
        {teachers.data?.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersIcon />
              </EmptyMedia>
              <EmptyTitle>Belum ada guru</EmptyTitle>
              <EmptyDescription>
                Tambahkan guru agar Nemu mengenali akun AlurSekolah dan nomor WhatsApp-nya.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email AlurSekolah</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Kelas</TableHead>
                <TableHead>Mata pelajaran</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.data
                ? teachers.data.map((teacher) => (
                    <TableRow key={teacher.id}>
                      <TableCell>
                        <div className="font-medium">{teacher.name}</div>
                        {teacher.nip && (
                          <div className="text-muted-foreground">NIP {teacher.nip}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{teacher.email}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatPhone(teacher.phone)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {teacher.classes.map((className) => (
                            <Badge key={className} variant="secondary">
                              {className}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">
                        {teacher.subjects.join(", ")}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <TeacherDialog teacher={teacher} />
                          <TeacherDeleteButton teacher={teacher} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                : SKELETON_ROWS.map((key) => (
                    <TableRow key={key}>
                      <TableCell colSpan={6}>
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

function TeacherDeleteButton({ teacher }: { teacher: Teacher }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const remove = useMutation(
    orpc.deleteTeacher.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        toast.success(`${teacher.name} dihapus`);
      },
      onError: (error) => toast.error(error.message),
      onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.listTeachers.key() }),
    }),
  );

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Hapus ${teacher.name}`} />}
      >
        <Trash2Icon />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus {teacher.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Nemu tidak lagi mengenali akun AlurSekolah dan nomor WhatsApp guru ini. Foto yang
            dikirim dari nomornya akan diabaikan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Batal</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate({ id: teacher.id })}
          >
            {remove.isPending && <Spinner />}
            Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
