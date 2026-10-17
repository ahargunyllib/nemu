import { Button } from "@nemu/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@nemu/ui/components/empty";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";

import { listDocumentsQueryOptions } from "@/features/documents/api/list-documents";
import DocumentStatusBadge from "@/features/documents/components/document-status-badge";
import { formatDate } from "@/features/documents/lib/format";

const RECENT_LIMIT = 5;
const SKELETON_ROWS = ["a", "b", "c"];

export default function RecentDocuments() {
  const documents = useQuery(listDocumentsQueryOptions());
  const recent = documents.data
    ?.toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, RECENT_LIMIT);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent documents</CardTitle>
        <CardDescription>The latest knowledge uploaded to the workspace.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" render={<Link to="/documents" />}>
            View all
            <ArrowRightIcon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {recent?.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No documents yet</EmptyTitle>
              <EmptyDescription>Uploaded documents show up here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-y">
            {recent
              ? recent.map((document) => (
                  <li key={document.id} className="flex items-center gap-4 py-3">
                    <div className="grid flex-1 gap-0.5">
                      <span className="text-sm font-medium">{document.title}</span>
                      <span className="text-xs text-muted-foreground">
                        v{document.version} · {formatDate(document.createdAt)}
                      </span>
                    </div>
                    <DocumentStatusBadge
                      status={document.status}
                      failureReason={document.failureReason}
                    />
                  </li>
                ))
              : SKELETON_ROWS.map((key) => (
                  <li key={key} className="grid gap-1.5 py-3">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </li>
                ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
