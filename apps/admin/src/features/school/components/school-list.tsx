import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { Skeleton } from "@nemu/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nemu/ui/components/table";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/shared/api/orpc";

/** WS-01: the schools Nemu serves. The MVP has one, SDIT Nusantara. */
export default function SchoolList() {
  const schools = useQuery(orpc.listSchools.queryOptions());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sekolah</CardTitle>
        <CardDescription>
          {schools.data ? `${schools.data.length} sekolah` : "Sekolah yang dilayani Nemu."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama sekolah</TableHead>
              <TableHead>Kode workspace</TableHead>
              <TableHead className="text-right">Guru</TableHead>
              <TableHead className="text-right">Kontak</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schools.data ? (
              schools.data.map((school) => (
                <TableRow key={school.id}>
                  <TableCell className="font-medium">{school.name}</TableCell>
                  <TableCell className="text-muted-foreground">{school.id}</TableCell>
                  <TableCell className="text-right">{school.teachers}</TableCell>
                  <TableCell className="text-right">{school.contacts}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
