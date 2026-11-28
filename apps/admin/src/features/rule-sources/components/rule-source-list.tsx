import { Badge } from "@nemu/ui/components/badge";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";

import RuleSourceDialog from "@/features/rule-sources/components/rule-source-dialog";
import { orpc } from "@/shared/api/orpc";

const SKELETON_ROWS = ["a", "b", "c"];

function formatLocation(article: string | null, page: number | null) {
  return [article, page && `hlm. ${page}`].filter(Boolean).join(" · ");
}

/**
 * The calculation rules and the document each cites (Dokumen dan alur's panel). With
 * `documentId`, only the rules citing that document; otherwise every rule, with its document.
 */
export default function RuleSourceList({ documentId }: { documentId?: string }) {
  const sources = useQuery(orpc.listRuleSources.queryOptions());
  const shown = sources.data?.filter(
    (source) => documentId === undefined || source.documentId === documentId,
  );
  const missing = shown?.filter((source) => !source.citationId).length ?? 0;

  if (!shown) {
    return (
      <div className="grid gap-2">
        {SKELETON_ROWS.map((key) => (
          <Skeleton key={key} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (!shown.length) {
    return (
      <p className="text-muted-foreground">Belum ada aturan hitung yang mengutip dokumen ini.</p>
    );
  }
  return (
    <div className="grid gap-3">
      {missing > 0 && (
        <p className="text-destructive">
          {missing} aturan tidak menemukan sumber aktif, jadi Nemu tidak bisa menghitungnya.
        </p>
      )}
      <ul className="grid gap-2">
        {shown.map((source) => (
          <li key={source.key} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{source.label}</div>
              <div className="text-muted-foreground">
                {[
                  documentId === undefined && (source.documentTitle ?? source.documentId),
                  formatLocation(source.article, source.page) || "Seluruh dokumen",
                  source.isDefault && "bawaan",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            {source.citationId ? (
              <Badge variant="secondary">Ditemukan</Badge>
            ) : (
              <Badge variant="destructive">Tidak ditemukan</Badge>
            )}
            <RuleSourceDialog source={source} />
          </li>
        ))}
      </ul>
    </div>
  );
}
