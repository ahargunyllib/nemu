import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import ChatLogList from "@/features/chat-log/components/chat-log-list";

export const Route = createFileRoute("/_auth/chat-log")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <PageHeading
        title="Chat Log"
        description="Every chat request Nemu received: who asked, the prompt, the sources and actions it answered with, and the result. Area Crop images are never stored."
      />
      <ChatLogList />
    </>
  );
}
