import { Badge } from "@nemu/ui/components/badge";
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

import RuleSourceDialog from "@/features/rule-sources/components/rule-source-dialog";
import { orpc } from "@/shared/api/orpc";

const SKELETON_ROWS = ["a", "b", "c", "d"];

function formatLocation(article: string | null, page: number | null) {
  return [article, page && `p. ${page}`].filter(Boolean).join(" · ");
}

export default function RuleSourceList() {
  const sources = useQuery(orpc.listRuleSources.queryOptions());
  const missing = sources.data?.filter((source) => !source.citationId).length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rule sources</CardTitle>
        <CardDescription>
          {missing > 0
            ? `${missing} rule${missing === 1 ? " has" : "s have"} no active source, so Nemu can't run ${missing === 1 ? "its calculation" : "their calculations"}.`
            : "The document each calculation cites. Point a rule at the new document when a regulation changes."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule</TableHead>
              <TableHead>Document</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.data
              ? sources.data.map((source) => (
                  <TableRow key={source.key}>
                    <TableCell className="font-medium">{source.label}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{source.documentTitle ?? source.documentId}</span>
                        {source.isDefault && <Badge variant="outline">Default</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatLocation(source.article, source.page) || "Whole document"}
                    </TableCell>
                    <TableCell>
                      {source.citationId ? (
                        <Badge variant="secondary">Found</Badge>
                      ) : (
                        <Badge variant="destructive">Not found</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <RuleSourceDialog source={source} />
                    </TableCell>
                  </TableRow>
                ))
              : SKELETON_ROWS.map((key) => (
                  <TableRow key={key}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
