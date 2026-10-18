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
import { useQuery } from "@tanstack/react-query";
import { CropIcon, MessagesSquareIcon, RefreshCwIcon } from "lucide-react";

import ChatStatusBadge from "@/features/chat-log/components/chat-status-badge";
import { orpc } from "@/shared/api/orpc";

const SKELETON_ROWS = ["a", "b", "c", "d", "e"];

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" });

export default function ChatLogList() {
  const log = useQuery(orpc.listChatLog.queryOptions());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chat requests</CardTitle>
        <CardDescription>
          {log.data
            ? `${log.data.length} most recent requests, newest first`
            : "Every chat request, newest first."}
        </CardDescription>
        <CardAction>
          <Button variant="outline" disabled={log.isFetching} onClick={() => log.refetch()}>
            {log.isFetching ? <Spinner /> : <RefreshCwIcon />}
            Refresh
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {log.data?.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessagesSquareIcon />
              </EmptyMedia>
              <EmptyTitle>No chat requests yet</EmptyTitle>
              <EmptyDescription>Requests appear here once someone asks Nemu.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Prompt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Sources</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.data
                ? log.data.map((entry) => (
                    <TableRow key={entry.id} className="align-top">
                      <TableCell className="align-top text-muted-foreground">
                        <div>{dateFormat.format(entry.createdAt)}</div>
                        <div className="text-xs">{(entry.durationMs / 1000).toFixed(1)} s</div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="font-medium">{entry.user?.name ?? entry.userId}</div>
                        {entry.user && (
                          <div className="text-xs text-muted-foreground">{entry.user.email}</div>
                        )}
                      </TableCell>
                      <TableCell className="min-w-56 align-top whitespace-normal">
                        <div>{entry.prompt}</div>
                        {entry.hasAreaCrop && (
                          <Badge variant="outline" className="mt-1">
                            <CropIcon data-icon="inline-start" />
                            Area Crop attached
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <ChatStatusBadge status={entry.status} />
                      </TableCell>
                      <TableCell className="min-w-64 align-top whitespace-normal">
                        {entry.status === "error" ? (
                          <pre className="font-mono text-xs whitespace-pre-wrap text-destructive">
                            {entry.result}
                          </pre>
                        ) : (
                          entry.result
                        )}
                      </TableCell>
                      <TableCell className="min-w-48 align-top whitespace-normal">
                        {entry.citations.length === 0 ? (
                          <span className="text-muted-foreground">None</span>
                        ) : (
                          <ul className="grid gap-1">
                            {entry.citations.map((citation) => (
                              <li key={`${citation.doc_id}-${citation.pasal ?? citation.halaman}`}>
                                {citation.judul}
                                {citation.pasal && (
                                  <span className="text-muted-foreground"> · {citation.pasal}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        {entry.actions.length === 0 ? (
                          <span className="text-muted-foreground">None</span>
                        ) : (
                          <div className="flex flex-col items-start gap-1">
                            {entry.actions.map((action) => (
                              <Badge
                                key={`${action.type}-${action.target}`}
                                variant="outline"
                                title={action.target}
                              >
                                {action.type} · {action.label}
                              </Badge>
                            ))}
                          </div>
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
