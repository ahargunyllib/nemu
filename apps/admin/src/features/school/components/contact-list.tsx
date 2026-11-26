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
import { Button } from "@nemu/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
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
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ContactDialog from "@/features/school/components/contact-dialog";
import { CONTACT_ROLES, type ContactRole, formatPhone } from "@/features/school/lib/directory";
import { orpc } from "@/shared/api/orpc";

/** WS-06: who a teacher is pointed to for problems that aren't theirs to fix, one per role. */
export default function ContactList() {
  const contacts = useQuery(orpc.listContacts.queryOptions());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kontak sekolah</CardTitle>
        <CardDescription>
          Nemu menyebut orang ini saat kendala guru perlu diselesaikan oleh perannya.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Peran</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {CONTACT_ROLES.map(({ role, label, description }) => {
              const contact = contacts.data?.find((item) => item.role === role);
              return (
                <TableRow key={role}>
                  <TableCell>
                    <div className="font-medium">{label}</div>
                    <div className="text-muted-foreground">{description}</div>
                  </TableCell>
                  {contacts.data ? (
                    <>
                      <TableCell>
                        {contact ? (
                          `${contact.honorific} ${contact.name}`
                        ) : (
                          <span className="text-muted-foreground">Belum diisi</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {contact ? formatPhone(contact.phone) : "—"}
                      </TableCell>
                    </>
                  ) : (
                    <TableCell colSpan={2}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <ContactDialog role={role} label={label} contact={contact} />
                      {contact && <ContactDeleteButton role={role} label={label} />}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ContactDeleteButton({ role, label }: { role: ContactRole; label: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const remove = useMutation(
    orpc.deleteContact.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        toast.success(`Kontak ${label.toLowerCase()} dihapus`);
      },
      onError: (error) => toast.error(error.message),
      onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.listContacts.key() }),
    }),
  );

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Hapus kontak ${label}`} />}
      >
        <Trash2Icon />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus kontak {label.toLowerCase()}?</AlertDialogTitle>
          <AlertDialogDescription>
            Nemu tidak bisa lagi menyebut siapa yang membantu kendala untuk peran ini sampai
            kontaknya diisi lagi.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Batal</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate({ role })}
          >
            {remove.isPending && <Spinner />}
            Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
