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
import { pageContentBoxes } from "../../features/answer-card/lib/page-content";
import { PANEL_WIDTH, panelBox, placePanel } from "../../features/answer-card/lib/panel-placement";
import { useCancelOnEscape } from "../../features/chat/hooks/use-cancel-on-escape";
import { useClickFollowUp } from "../../features/chat/hooks/use-click-follow-up";
import { useLocationFollowUp } from "../../features/chat/hooks/use-location-follow-up";
import { useNemuChat } from "../../features/chat/hooks/use-nemu-chat";
import { COMPOSER_WIDTH, Composer } from "../../features/composer/components/composer";
import { ReadingPill } from "../../features/composer/components/reading-pill";
import {
  type CursorPosition,
  useComposerShortcut,
} from "../../features/composer/hooks/use-composer-shortcut";
import { FillCheck } from "../../features/confirmed-fill/components/fill-check";
import { FillValue } from "../../features/confirmed-fill/components/fill-value";
import { useConfirmedFill } from "../../features/confirmed-fill/hooks/use-confirmed-fill";
import { collectElementList } from "../../features/element-list/lib/element-list";
import { HighlightRing } from "../../features/highlight/components/highlight-ring";
import { StepProgress } from "../../features/highlight/components/step-progress";
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
/**
 * Room around the panel inside its scroll box, so the scroll box doesn't clip the cards' shadow
 * into a square box. shadow/float (`--nemu-shadow-float`, 0 16px 40px) reaches 40px to each side,
 * 24px above, and 56px below.
 */
const SHADOW_ROOM = { top: 24, x: 40, bottom: 56 };
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
  const { highlight, steps, stepIndex, missing, warnings, cursor, outcome, clicked, clickedFrom } =
    useAnswerActions(actions, state.kind === "response" ? state.elements : NO_ELEMENTS, anchor);
  const confirmedFills = useConfirmedFill(actions, highlight);
  // A guide continues from the settled page opened by its navigation click.
  useClickFollowUp(
    clicked,
    clickedFrom,
    state.kind === "response" ? state.response.guide : undefined,
    chat.followUp,
  );
  useLocationFollowUp(chat.guideSession, chat.followUp);
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

  // Esc while Membaca shows cancels the prompt. With the Composer open, Esc only closes it.
  useCancelOnEscape(state.kind === "loading" && !composerOpen, close);

  const header = state.kind === "idle" ? null : <AnswerCardHeader onClose={close} />;
  const areaChip = (area.state.kind === "attached" || area.state.kind === "failed") && (
    <AreaCropChip state={area.state} onRemove={area.clear} />
  );

  // While a step is highlighted the panel hangs beside its target, clear of the next step's. A card
  // with no target goes into empty space; the Composer and Membaca stay where the Composer opened.
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const showsCard =
    state.kind === "response" || state.kind === "unauthorized" || state.kind === "error";
  const placement =
    anchor &&
    (highlight
      ? placePanel(
          { target: highlightFootprint(highlight.box) },
          viewport,
          panelHeight,
          highlight.next ? [highlight.next] : [],
          PANEL_ROOM,
        )
      : placePanel(
          { cursor: anchor },
          viewport,
          panelHeight,
          showsCard ? pageContentBoxes(viewport) : [],
          PANEL_ROOM,
        ));
  const guidingCard =
    highlight && placement ? panelBox(placement, panelHeight, viewport, PANEL_WIDTH) : null;

  // One font and text color for everything Nemu draws: highlights, the mascot (#6), and the panel.
  // All of it is hidden while the viewport is captured, so an Area Crop shows only the page. Its
  // transitions go too: a Button's transition-all would keep it visible for the whole transition,
  // so the mascot and the Composer's buttons ended up in the capture.
  return (
    <div
      ref={nemuRef}
      className={
        area.state.kind === "capturing"
          ? "invisible font-sans text-foreground **:transition-none"
          : "font-sans text-foreground"
      }
    >
      <PageLayer>
        {(composerOpen || state.kind === "response") && area.selection && (
          <AreaOutline box={area.selection} />
        )}
        {state.kind === "loading" && readArea && <AreaOutline box={readArea} reading />}
        {highlight && <HighlightRing box={highlight.box} action={highlight.action} />}
        {confirmedFills.checks.map((check) => (
          <FillCheck key={check.action.target} check={check} />
        ))}
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
          guidingCard={guidingCard}
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
            width: PANEL_ROOM + 2 * SHADOW_ROOM.x,
            maxHeight: placement.maxHeight + SHADOW_ROOM.top + SHADOW_ROOM.bottom,
            margin: `${-SHADOW_ROOM.top}px ${-SHADOW_ROOM.x}px ${-SHADOW_ROOM.bottom}px`,
            padding: `${SHADOW_ROOM.top}px ${SHADOW_ROOM.x}px ${SHADOW_ROOM.bottom}px`,
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
                kicker={
                  <StepProgress steps={steps} guide={state.response.guide} index={stepIndex} />
                }
                fill={confirmedFills.pending && <FillValue fill={confirmedFills.pending} />}
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
