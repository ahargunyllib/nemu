import { Badge } from "@nemu/ui/components/badge";

import type { KnowledgeItem } from "@/features/documents/lib/knowledge";

/** Aktif, Nonaktif, or Gagal (could not be read): whether Nemu answers from it today. */
export default function KnowledgeStatusBadge({
  document,
}: {
  document: Pick<KnowledgeItem, "isActive" | "status"> & { failureReason?: string | null };
}) {
  if (document.status === "failed") {
    return (
      <Badge variant="destructive" title={document.failureReason ?? undefined}>
        Gagal
      </Badge>
    );
  }
  return document.isActive ? (
    <Badge variant="secondary">Aktif</Badge>
  ) : (
    <Badge variant="outline">Nonaktif</Badge>
  );
}
