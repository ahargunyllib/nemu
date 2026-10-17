import type { NemuAction, PageElement } from "@nemu/contracts";
import { useState } from "react";

import { useAnswerActions } from "../../features/action-level/hooks/use-answer-actions";
import { AnswerCard } from "../../features/answer-card/components/answer-card";
import { AnswerCardHeader } from "../../features/answer-card/components/answer-card-header";
import { AnswerCardSkeleton } from "../../features/answer-card/components/answer-card-skeleton";
import {
  ChatErrorCard,
  LoginRequiredCard,
} from "../../features/answer-card/components/chat-notice-card";
import { PANEL_WIDTH, placePanel } from "../../features/answer-card/lib/panel-placement";
import { useNemuChat } from "../../features/chat/hooks/use-nemu-chat";
import { Composer } from "../../features/composer/components/composer";
import {
  type CursorPosition,
  useComposerShortcut,
} from "../../features/composer/hooks/use-composer-shortcut";
import { collectElementList } from "../../features/element-list/lib/element-list";
import { HighlightRing } from "../../features/highlight/components/highlight-ring";
import {
  highlightFootprint,
  missingTargetWarning,
} from "../../features/highlight/lib/highlight-targets";
import { NavigationCursor } from "../../features/navigation-click/components/navigation-cursor";
import { PageLayer } from "../../shared/components/page-layer";
import { useElementHeight } from "../../shared/hooks/use-element-height";

const NO_ACTIONS: NemuAction[] = [];
const NO_ELEMENTS: PageElement[] = [];

export function NemuOverlay() {
  const [anchor, setAnchor] = useState<CursorPosition | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const chat = useNemuChat();
  const { state } = chat;
  const { highlights, missing, warnings, cursor } = useAnswerActions(
    state.kind === "response" ? state.response.actions : NO_ACTIONS,
    state.kind === "response" ? state.elements : NO_ELEMENTS,
    anchor,
  );
  const [panelRef, panelHeight] = useElementHeight<HTMLDivElement>();

  useComposerShortcut((position) => {
    setAnchor(position);
    setComposerOpen(true);
  });

  function ask(prompt: string) {
    void chat.send(prompt, collectElementList(document));
  }

  function close() {
    chat.reset();
    setComposerOpen(false);
    setAnchor(null);
  }

  const header =
    state.kind === "idle" ? null : <AnswerCardHeader prompt={state.prompt} onClose={close} />;

  // One font and text color for everything Nemu draws: highlights, the mascot (#6), and the panel.
  return (
    <div className="font-sans text-foreground">
      <PageLayer>
        {highlights.map(({ action, box }, index) => (
          <HighlightRing key={`${index}-${action.target}`} box={box} label={action.label} />
        ))}
        {cursor && <NavigationCursor frame={cursor} />}
      </PageLayer>
      {anchor && (
        <div
          ref={panelRef}
          className="fixed z-2147483647 flex flex-col gap-2 overflow-y-auto"
          style={{
            width: PANEL_WIDTH,
            ...placePanel(
              anchor,
              { width: window.innerWidth, height: window.innerHeight },
              panelHeight,
              highlights.map(({ box }) => highlightFootprint(box)),
            ),
          }}
        >
          {composerOpen && (
            <Composer
              onSubmit={(prompt) => {
                setComposerOpen(false);
                ask(prompt);
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
              response={{
                ...state.response,
                warnings: [
                  ...state.response.warnings,
                  ...missing.map(missingTargetWarning),
                  ...warnings,
                ],
              }}
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
              onRetry={() => ask(state.prompt)}
            />
          )}
        </div>
      )}
    </div>
  );
}
