import type { NemuAction, PageElement } from "@nemu/contracts";
import { useRef, useState } from "react";

import { useAnswerActions } from "../../features/action-level/hooks/use-answer-actions";
import { AreaCropChip } from "../../features/area-crop/components/area-crop-chip";
import { AreaOutline } from "../../features/area-crop/components/area-outline";
import { AreaSelectLayer } from "../../features/area-crop/components/area-select-layer";
import { useAreaCrop } from "../../features/area-crop/hooks/use-area-crop";
import { AnswerCard } from "../../features/answer-card/components/answer-card";
import { AnswerCardHeader } from "../../features/answer-card/components/answer-card-header";
import {
  ChatErrorCard,
  LoginRequiredCard,
} from "../../features/answer-card/components/chat-notice-card";
import { PANEL_WIDTH, placePanel } from "../../features/answer-card/lib/panel-placement";
import { useClickFollowUp } from "../../features/chat/hooks/use-click-follow-up";
import { useNemuChat } from "../../features/chat/hooks/use-nemu-chat";
import { COMPOSER_WIDTH, Composer } from "../../features/composer/components/composer";
import { ReadingPill } from "../../features/composer/components/reading-pill";
import {
  type CursorPosition,
  useComposerShortcut,
} from "../../features/composer/hooks/use-composer-shortcut";
import { collectElementList } from "../../features/element-list/lib/element-list";
import { HighlightRing } from "../../features/highlight/components/highlight-ring";
import { HighlightSteps } from "../../features/highlight/components/highlight-steps";
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
import type { Box } from "../../shared/types/box";

const NO_ACTIONS: NemuAction[] = [];
const NO_ELEMENTS: PageElement[] = [];
/** Room around the panel inside its scroll box, so the scroll box doesn't clip the cards' shadow. */
const SHADOW_ROOM = 16;
/** The Composer keeps its own width, so the panel makes room for it even when it is wider. */
const PANEL_ROOM = Math.max(PANEL_WIDTH, COMPOSER_WIDTH);

export function NemuOverlay() {
  const [anchor, setAnchor] = useState<CursorPosition | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  /** The Blok area sent with the prompt Nemu is reading. */
  const [readArea, setReadArea] = useState<Box | null>(null);
  /** The Blok area while Rina drags it. */
  const [draggedArea, setDraggedArea] = useState<Box | null>(null);
  const chat = useNemuChat();
  const area = useAreaCrop();
  const { state } = chat;
  const actions = state.kind === "response" ? state.response.actions : NO_ACTIONS;
  const { highlight, steps, stepIndex, goTo, missing, warnings, cursor, outcome, clicked } =
    useAnswerActions(actions, state.kind === "response" ? state.elements : NO_ELEMENTS, anchor);
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

  /** Closes only the Composer; an answer still on screen keeps its place. */
  function closeComposer() {
    setComposerOpen(false);
    area.clear();
    if (state.kind === "idle") setAnchor(null);
  }

  /** Sends a prompt from the Composer, on top of the panel or as Balas in the Answer Card. */
  function submitComposer(prompt: string) {
    setComposerOpen(false);
    setReadArea(area.crop ? (area.selection ?? null) : null);
    ask(prompt, area.crop);
    area.clear();
  }

  function close() {
    chat.reset();
    area.clear();
    setComposerOpen(false);
    setAnchor(null);
  }

  const header = state.kind === "idle" ? null : <AnswerCardHeader onClose={close} />;
  const areaChip = (area.state.kind === "attached" || area.state.kind === "failed") && (
    <AreaCropChip state={area.state} onRemove={area.clear} />
  );

  const placement =
    anchor &&
    placePanel(
      anchor,
      { width: window.innerWidth, height: window.innerHeight },
      panelHeight,
      highlight ? [highlightFootprint(highlight.box)] : [],
      PANEL_ROOM,
    );

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
        {(composerOpen || state.kind === "response") && area.selection && (
          <AreaOutline box={area.selection} />
        )}
        {state.kind === "loading" && readArea && <AreaOutline box={readArea} reading />}
        {highlight && <HighlightRing box={highlight.box} action={highlight.action} />}
        {cursor && <NavigationCursor frame={cursor} />}
        <Mascot
          activity={{
            // Area select mode keeps the Composer open, so dragging a box counts as listening too.
            listening: composerOpen,
            thinking: state.kind === "loading",
            clicking: cursor?.mascot === "clicking",
            guiding: Boolean(highlight),
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
          draggedArea={area.state.kind === "selecting" ? draggedArea : null}
          onOpenComposer={openComposer}
        />
      </PageLayer>
      {placement && (
        <div
          // Stays up under the area select layer, where the Composer says how to drag a box. While
          // Nemu's cursor is out it drops under the page layer, so it never covers the cursor, its
          // tooltip, or the mascot riding along.
          className={
            cursor
              ? "pointer-events-none fixed z-2147483645 overflow-y-auto"
              : "pointer-events-none fixed z-2147483647 overflow-y-auto"
          }
          style={{
            ...placement,
            width: PANEL_ROOM + 2 * SHADOW_ROOM,
            maxHeight: placement.maxHeight + 2 * SHADOW_ROOM,
            margin: -SHADOW_ROOM,
            padding: SHADOW_ROOM,
          }}
        >
          {/* Measured inside the scroll box, so a panel shrunk to keep off a highlight still
              reports its full height. */}
          <div
            ref={panelRef}
            className="pointer-events-auto flex flex-col gap-2"
            style={{ width: PANEL_WIDTH }}
          >
            {composerOpen && (
              <Composer
                onSubmit={submitComposer}
                onCancel={closeComposer}
                onPickArea={area.start}
                picking={area.state.kind === "selecting"}
                boundary={nemuRef}
              >
                {areaChip}
              </Composer>
            )}
            {/* Membaca: in the Composer's place until the answer arrives. */}
            {state.kind === "loading" && <ReadingPill />}
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
                reply={
                  // Balas: the same Composer inside the card, while none is open above it. A click
                  // on the page only drops its Area Crop, so the answer stays while Rina acts.
                  !composerOpen && (
                    <Composer
                      onSubmit={submitComposer}
                      onCancel={area.clear}
                      onPickArea={area.start}
                      picking={area.state.kind === "selecting"}
                      boundary={nemuRef}
                    >
                      {areaChip}
                    </Composer>
                  )
                }
              >
                <HighlightSteps steps={steps} index={stepIndex} onGoTo={goTo} />
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
        <AreaSelectLayer onSelect={area.select} onCancel={area.clear} onDrag={setDraggedArea} />
      )}
    </div>
  );
}
