import type { NemuAction, PageElement } from "@nemu/contracts";
import { useRef, useState } from "react";

import { useAnswerActions } from "../../features/action-level/hooks/use-answer-actions";
import { AreaCropChip } from "../../features/area-crop/components/area-crop-chip";
import { AreaSelectLayer } from "../../features/area-crop/components/area-select-layer";
import { useAreaCrop } from "../../features/area-crop/hooks/use-area-crop";
import { AnswerCard } from "../../features/answer-card/components/answer-card";
import { AnswerCardHeader } from "../../features/answer-card/components/answer-card-header";
import { AnswerCardSkeleton } from "../../features/answer-card/components/answer-card-skeleton";
import {
  ChatErrorCard,
  LoginRequiredCard,
} from "../../features/answer-card/components/chat-notice-card";
import { PANEL_WIDTH, placePanel } from "../../features/answer-card/lib/panel-placement";
import { useClickFollowUp } from "../../features/chat/hooks/use-click-follow-up";
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
import { Mascot } from "../../features/mascot/components/mascot";
import { NavigationCursor } from "../../features/navigation-click/components/navigation-cursor";
import { ConfirmedStatus } from "../../features/process-status/components/confirmed-status";
import { useConfirmedStatus } from "../../features/process-status/hooks/use-confirmed-status";
import { PageLayer } from "../../shared/components/page-layer";
import { useElementHeight } from "../../shared/hooks/use-element-height";

const NO_ACTIONS: NemuAction[] = [];
const NO_ELEMENTS: PageElement[] = [];

export function NemuOverlay() {
  const [anchor, setAnchor] = useState<CursorPosition | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const chat = useNemuChat();
  const area = useAreaCrop();
  const { state } = chat;
  const actions = state.kind === "response" ? state.response.actions : NO_ACTIONS;
  const { highlights, missing, warnings, cursor, outcome, clicked } = useAnswerActions(
    actions,
    state.kind === "response" ? state.elements : NO_ELEMENTS,
    anchor,
  );
  // Momen 3: opening the task asks again from the task page, where the uploads and Kirim are.
  useClickFollowUp(clicked, chat.followUp);
  const confirmed = useConfirmedStatus(actions);
  const [panelRef, panelHeight] = useElementHeight<HTMLDivElement>();
  const nemuRef = useRef<HTMLDivElement>(null);

  function openComposer(position: CursorPosition) {
    setAnchor(position);
    setComposerOpen(true);
  }

  useComposerShortcut(openComposer);

  function ask(prompt: string, screenshotCrop?: string) {
    void chat.send(prompt, collectElementList(document), screenshotCrop);
  }

  function close() {
    chat.reset();
    area.clear();
    setComposerOpen(false);
    setAnchor(null);
  }

  const header =
    state.kind === "idle" ? null : <AnswerCardHeader prompt={state.prompt} onClose={close} />;

  const pickingArea = area.state.kind === "selecting" || area.state.kind === "capturing";

  // One font and text color for everything Nemu draws: highlights, the mascot (#6), and the panel.
  // All of it is hidden while the viewport is captured, so an Area Crop shows only the page.
  return (
    <div
      ref={nemuRef}
      className={
        area.state.kind === "capturing"
          ? "invisible font-sans text-foreground"
          : "font-sans text-foreground"
      }
    >
      <PageLayer>
        {highlights.map(({ action, box }, index) => (
          <HighlightRing key={`${index}-${action.target}`} box={box} label={action.label} />
        ))}
        {cursor && <NavigationCursor frame={cursor} />}
        <Mascot
          activity={{
            // Area select mode keeps the Composer open, so dragging a box counts as listening too.
            listening: composerOpen,
            thinking: state.kind === "loading",
            clicking: cursor?.mascot === "clicking",
            guiding: highlights.length > 0,
            succeeded: outcome === "succeeded",
            failed:
              state.kind === "error" ||
              state.kind === "unauthorized" ||
              missing.length > 0 ||
              outcome === "missing" ||
              outcome === "no-change",
          }}
          composerAnchor={composerOpen ? anchor : null}
          nemuCursor={cursor}
          onOpenComposer={openComposer}
        />
      </PageLayer>
      {anchor && (
        <div
          // Hidden, not unmounted, during area select mode so the Composer keeps its text.
          className={pickingArea ? "hidden" : "fixed z-2147483647 overflow-y-auto"}
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
          {/* Measured inside the scroll box, so a panel shrunk to keep off a highlight still
              reports its full height. */}
          <div ref={panelRef} className="flex flex-col gap-2">
            {composerOpen && (
              <Composer
                onSubmit={(prompt) => {
                  setComposerOpen(false);
                  ask(prompt, area.crop);
                  area.clear();
                }}
                onCancel={() => {
                  setComposerOpen(false);
                  area.clear();
                  if (state.kind === "idle") setAnchor(null);
                }}
                onPickArea={area.start}
                boundary={nemuRef}
              >
                {(area.state.kind === "attached" || area.state.kind === "failed") && (
                  <AreaCropChip state={area.state} onRemove={area.clear} />
                )}
              </Composer>
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
              >
                {confirmed && <ConfirmedStatus status={confirmed} />}
              </AnswerCard>
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
                onRetry={() => ask(state.prompt, state.screenshotCrop)}
              />
            )}
          </div>
        </div>
      )}
      {area.state.kind === "selecting" && (
        <AreaSelectLayer onSelect={area.select} onCancel={area.clear} />
      )}
    </div>
  );
}
