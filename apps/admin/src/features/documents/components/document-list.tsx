import { Badge } from "@nemu/ui/components/badge";
import { Button } from "@nemu/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@nemu/ui/components/empty";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { Switch } from "@nemu/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nemu/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { client, orpc } from "@/shared/api/orpc";

const SKELETON_ROWS = ["a", "b", "c"];

export default function DocumentList() {
  const documents = useQuery(orpc.listDocuments.queryOptions());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <CardDescription>Uploaded knowledge documents and their status.</CardDescription>
      </CardHeader>
      <CardContent>
        {documents.data?.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No documents yet</EmptyTitle>
              <EmptyDescription>Upload a PDF or Markdown file to get started.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.data
                ? documents.data.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell className="font-medium">{document.title}</TableCell>
                      <TableCell>{document.version}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {document.fileName} · {formatSize(document.sizeBytes)}
                      </TableCell>
                      <TableCell>
                        {document.status === "ready" ? (
                          <Badge variant="secondary">Ready</Badge>
                        ) : (
                          <Badge variant="destructive" title={document.failureReason ?? undefined}>
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DocumentActiveSwitch id={document.id} isActive={document.isActive} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {document.createdAt.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {document.status === "ready" && (
                          <Button variant="ghost" size="sm" onClick={() => openFile(document.id)}>
                            Open
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                : SKELETON_ROWS.map((key) => (
                    <TableRow key={key}>
                      <TableCell colSpan={7}>
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

function DocumentActiveSwitch({ id, isActive }: { id: string; isActive: boolean }) {
  const queryClient = useQueryClient();
  const setActive = useMutation(
    orpc.setDocumentActive.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.listDocuments.key() }),
    }),
  );

  return (
    <Switch
      aria-label="Active"
      checked={setActive.isPending ? setActive.variables.isActive : isActive}
      disabled={setActive.isPending}
      onCheckedChange={(checked) => setActive.mutate({ id, isActive: checked })}
    />
  );
}

async function openFile(id: string) {
  try {
    const file = await client.getDocumentFile({ id });
    window.open(URL.createObjectURL(file), "_blank", "noopener");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Could not open the file");
  }
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
