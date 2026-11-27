import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { Label } from "@nemu/ui/components/label";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { Switch } from "@nemu/ui/components/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { formatDate } from "@/features/documents/lib/format";
import { orpc } from "@/shared/api/orpc";

/** WS-02: whether Nemu answers every school from the built-in AlurSekolah package. */
export default function PackageScopeCard() {
  const knowledgePackage = useQuery(orpc.getKnowledgePackage.queryOptions());
  const queryClient = useQueryClient();
  const setAllSchools = useMutation(
    orpc.setPackageAllSchools.mutationOptions({
      onSuccess: (_, { allSchools }) =>
        toast.success(
          allSchools ? "Paket berlaku untuk semua sekolah" : "Paket hanya untuk sekolah ini",
        ),
      onError: (error) => toast.error(error.message),
      onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.getKnowledgePackage.key() }),
    }),
  );

  if (!knowledgePackage.data) return <Skeleton className="h-28 w-full rounded-4xl" />;
  const { title, allSchools, updatedAt } = knowledgePackage.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Panduan bawaan cara memakai AlurSekolah, dikelola Javan. Diubah {formatDate(updatedAt)}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Switch
            id="package-all-schools"
            checked={setAllSchools.isPending ? setAllSchools.variables.allSchools : allSchools}
            disabled={setAllSchools.isPending}
            onCheckedChange={(checked) => setAllSchools.mutate({ allSchools: checked })}
          />
          <Label htmlFor="package-all-schools">Berlaku untuk semua sekolah</Label>
        </div>
        <p className="mt-2 text-muted-foreground">
          Bila aktif, dokumen aktif di paket ini menjadi sumber jawaban Nemu di setiap sekolah,
          bukan hanya di sekolah Javan.
        </p>
      </CardContent>
    </Card>
  );
}
