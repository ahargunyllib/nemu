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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@nemu/ui/components/input-group";
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
import { ExternalLinkIcon, FileTextIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { listDocumentsQueryOptions } from "@/features/documents/api/list-documents";
import DocumentStatusBadge from "@/features/documents/components/document-status-badge";
import { formatDate, formatSize } from "@/features/documents/lib/format";
import { client, orpc } from "@/shared/api/orpc";

const SKELETON_ROWS = ["a", "b", "c"];

export default function DocumentList() {
  const documents = useQuery(listDocumentsQueryOptions());
  const [query, setQuery] = useState("");

  const filtered = documents.data?.filter((document) =>
    `${document.title} ${document.fileName}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>All documents</CardTitle>
        <CardDescription>
          {documents.data
            ? `${documents.data.length} documents · ${documents.data.filter((d) => d.isActive).length} active`
            : "Uploaded knowledge documents and their status."}
        </CardDescription>
        <CardAction>
          <InputGroup className="w-48 sm:w-64">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Search documents"
              placeholder="Search documents…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </InputGroup>
        </CardAction>
      </CardHeader>
      <CardContent>
        {filtered?.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileTextIcon />
              </EmptyMedia>
              <EmptyTitle>{query ? "No matching documents" : "No documents yet"}</EmptyTitle>
              <EmptyDescription>
                {query
                  ? "Try a different title or file name."
                  : "Upload a PDF or Markdown file to get started."}
              </EmptyDescription>
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
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered
                ? filtered.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell className="font-medium">{document.title}</TableCell>
                      <TableCell>{document.version}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {document.fileName} · {formatSize(document.sizeBytes)}
                      </TableCell>
                      <TableCell>
                        <DocumentStatusBadge
                          status={document.status}
                          failureReason={document.failureReason}
                        />
                      </TableCell>
                      <TableCell>
                        <DocumentActiveSwitch id={document.id} isActive={document.isActive} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(document.createdAt)}
                      </TableCell>
                      <TableCell>
                        {document.status === "ready" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Open ${document.title}`}
                            onClick={() => openFile(document.id)}
                          >
                            <ExternalLinkIcon />
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
