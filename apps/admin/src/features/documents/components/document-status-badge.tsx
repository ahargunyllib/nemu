import { Badge } from "@nemu/ui/components/badge";

export default function DocumentStatusBadge({
  status,
  failureReason,
}: {
  status: "ready" | "failed";
  failureReason: string | null;
}) {
  return status === "ready" ? (
    <Badge variant="secondary">Siap</Badge>
  ) : (
    <Badge variant="destructive" title={failureReason ?? undefined}>
      Gagal
    </Badge>
  );
}
