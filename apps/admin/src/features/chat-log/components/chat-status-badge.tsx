import { Badge } from "@nemu/ui/components/badge";
import { CircleAlertIcon } from "lucide-react";

import { CHAT_STATUS_LABELS, type ChatStatus } from "@/features/chat-log/lib/chat-status";

export default function ChatStatusBadge({ status }: { status: ChatStatus }) {
  const variant =
    status === "answer" ? "secondary" : status === "error" ? "destructive" : "outline";
  return (
    <Badge variant={variant}>
      {status === "error" && <CircleAlertIcon data-icon="inline-start" />}
      {CHAT_STATUS_LABELS[status]}
    </Badge>
  );
}
