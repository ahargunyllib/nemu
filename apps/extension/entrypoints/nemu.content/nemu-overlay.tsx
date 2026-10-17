import { useState } from "react";

import { AnswerCard } from "../../features/answer-card/components/answer-card";
import { AnswerCardHeader } from "../../features/answer-card/components/answer-card-header";
import { AnswerCardSkeleton } from "../../features/answer-card/components/answer-card-skeleton";
import {
  ChatErrorCard,
  LoginRequiredCard,
} from "../../features/answer-card/components/chat-notice-card";
import { useNemuChat } from "../../features/chat/hooks/use-nemu-chat";
import { Composer } from "../../features/composer/components/composer";
import {
  type CursorPosition,
  useComposerShortcut,
} from "../../features/composer/hooks/use-composer-shortcut";

const PANEL_WIDTH = 384;
const GAP = 12;

/** Opens beside the cursor, below it in the top half of the screen and above it in the bottom half. */
function panelPosition({ x, y }: CursorPosition): React.CSSProperties {
  const left = Math.max(GAP, Math.min(x + GAP, window.innerWidth - PANEL_WIDTH - GAP));
  return y < window.innerHeight / 2
    ? { left, top: y + GAP, maxHeight: window.innerHeight - y - 2 * GAP }
    : { left, bottom: window.innerHeight - y + GAP, maxHeight: y - 2 * GAP };
}

export function NemuOverlay() {
  const [anchor, setAnchor] = useState<CursorPosition | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const chat = useNemuChat();

  useComposerShortcut((position) => {
    setAnchor(position);
    setComposerOpen(true);
  });

  if (!anchor) return null;

  function close() {
    chat.reset();
    setComposerOpen(false);
    setAnchor(null);
  }

  const { state } = chat;
  const header =
    state.kind === "idle" ? null : <AnswerCardHeader prompt={state.prompt} onClose={close} />;

  return (
    <div
      className="fixed z-2147483647 flex flex-col gap-2 overflow-y-auto font-sans text-foreground"
      style={{ width: PANEL_WIDTH, ...panelPosition(anchor) }}
    >
      {composerOpen && (
        <Composer
          onSubmit={(prompt) => {
            setComposerOpen(false);
            void chat.send(prompt);
          }}
          onCancel={() => {
            setComposerOpen(false);
            if (state.kind === "idle") setAnchor(null);
          }}
        />
      )}
      {state.kind === "loading" && <AnswerCardSkeleton header={header} />}
      {state.kind === "response" && (
        <AnswerCard
          key={state.prompt}
          response={state.response}
          header={header}
          onReply={() => setComposerOpen(true)}
        />
      )}
      {state.kind === "unauthorized" && (
        <LoginRequiredCard
          header={header}
          loginUrl={new URL("/login", window.location.href).href}
        />
      )}
      {state.kind === "error" && (
        <ChatErrorCard
          header={header}
          message={state.message}
          onRetry={() => void chat.send(state.prompt)}
        />
      )}
    </div>
  );
}
