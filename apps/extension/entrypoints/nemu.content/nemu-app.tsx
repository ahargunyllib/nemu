import type { PageSnapshot } from "@nemu/contracts/school";
import { shortcutKeys } from "@nemu/contracts/talk-shortcut";
import { Button } from "@nemu/ui/components/button";
import { GelembungJawab, GelembungJawabSkeleton } from "@nemu/ui/nemu/gelembung-jawab";
import { NEMU_LINK } from "@nemu/ui/nemu/nemu-frame";
import { NemuStage } from "@nemu/ui/nemu/nemu-stage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SiteAccess } from "../../features/allowed-sites/lib/site-access";
import { DisplayPreviewDock } from "../../features/display-preview/components/display-preview-dock";
import { useDisplayPreview } from "../../features/display-preview/hooks/use-display-preview";
import { PREVIEW_ENABLED } from "../../features/display-preview/lib/preview-scenes";
import { ExecutorTestDock } from "../../features/executor/components/executor-test-dock";
import { RowTicks } from "../../features/executor/components/row-ticks";
import { useExecutor } from "../../features/executor/hooks/use-executor";
import { TEST_TOOLS_ENABLED } from "../../features/executor/lib/test-responses";
import { executor } from "../../features/executor/stores/executor";
import { useGradePhoto } from "../../features/grade-photo/hooks/use-grade-photo";
import { gradePhoto } from "../../features/grade-photo/stores/grade-photo";
import { useIdentity } from "../../features/identity/hooks/use-identity";
import { usePageEmail } from "../../features/identity/hooks/use-page-email";
import type { IdentityResult } from "../../features/identity/lib/identity";
import { useNextAction } from "../../features/ini-kenapa/hooks/use-next-action";
import { readPageSnapshot } from "../../features/ini-kenapa/lib/page-snapshot";
import { AskBox } from "../../features/nemu-button/components/ask-box";
import { useProcessRun } from "../../features/process-run/hooks/use-process-run";
import { processRun } from "../../features/process-run/stores/process-run";
import { useRecorder } from "../../features/recorder/hooks/use-recorder";
import { recorder } from "../../features/recorder/stores/recorder";
import { NemuButton } from "../../features/nemu-button/components/nemu-button";
import { type AskState, useAsk } from "../../features/nemu-button/hooks/use-ask";
import { HeardBubble, ListeningBubble } from "../../features/voice/components/talk-bubbles";
import { useTalk } from "../../features/voice/hooks/use-talk";
import { useVoice, type VoiceState } from "../../features/voice/hooks/use-voice";
import type { TalkState } from "../../features/voice/lib/talk-machine";
import { talkShortcutFrom } from "../../features/voice/lib/talk-shortcut";
import { spokenWordIn, withSpokenWord } from "../../features/voice/lib/word-timing";
import { voiceCommands } from "../../features/voice/stores/voice-commands";

/**
 * Everything Nemu draws on an allowed page (WS-03): the Nemu button and, once it is clicked or the
 * talk combination is held, the panel above it. Who Nemu helps follows the account signed in on
 * the page. Only one of the five display types shows at a time (PRD §6.2), and Nemu speaks the
 * main sentence of every answer. The talk combination is the school's WS-08 setting from `access`;
 * the executor reads the site's WS-03 permission and the WS-08 defaults itself (`executorSettings`).
 */
export function NemuApp({ access }: { access: SiteAccess }) {
  const talkShortcut = access.settings.talkShortcut;
  const shortcut = useMemo(() => talkShortcutFrom(talkShortcut), [talkShortcut]);
  const pageEmail = usePageEmail();
  const identity = useIdentity(pageEmail);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const startGrades = useCallback(
    (utterance: string) => {
      close();
      void gradePhoto.command(utterance);
    },
    [close],
  );
  const startProcess = useCallback(
    (utterance: string, processName: string) => {
      close();
      void processRun.start(utterance, processName);
    },
    [close],
  );
  const startRecording = useCallback(
    (title: string) => {
      close();
      recorder.start(title);
    },
    [close],
  );
  const { state, ask, reset } = useAsk(pageEmail, close, startGrades, startProcess, startRecording);
  const preview = useDisplayPreview();
  const { voice, working, speak, repeat, stop } = useVoice(pageEmail);
  const run = useExecutor();
  // "ini kenapa?" reads the page as it was when the talk combination went down (F2-01).
  const pressSnapshot = useRef<PageSnapshot | null>(null);
  const grades = useGradePhoto();
  const process = useProcessRun();
  const recording = useRecorder();
  const talk = useTalk({
    pageEmail,
    shortcut,
    enabled: identity?.status === "registered",
    isWorking: () => working || voiceCommands.isWorking(),
    onStart: () => {
      pressSnapshot.current = readPageSnapshot(document, location.href);
      recorder.talkStarted();
      setOpen(true);
    },
    // While F1 or F3 waits for an answer (a photo question, a number), the words are that answer.
    // While "Rekam cara" records, the words are the operator's narration.
    onQuestion: (question) => {
      if (recorder.narrate(question)) return;
      if (!gradePhoto.hear(question) && !processRun.hear(question))
        void ask(question, pressSnapshot.current);
    },
  });
  const { dismiss } = talk;

  const askTyped = useCallback(
    (question: string) => {
      dismiss();
      void ask(question);
    },
    [dismiss, ask],
  );

  const dismissAll = useCallback(() => {
    reset();
    dismiss();
    stop();
  }, [reset, dismiss, stop]);

  // After "ini kenapa?": show how to fix it (cara 2) or open the WhatsApp message.
  const answerNext =
    state.status === "answered" && state.result.kind === "answer" ? state.result.next : undefined;
  const nextAction = useNextAction(
    answerNext,
    useCallback(() => {
      dismissAll();
      close();
    }, [dismissAll, close]),
  );

  // The executor works as the teacher on the page, in Nemu's voice.
  const honorific = identity?.status === "registered" ? identity.honorific : "";
  useEffect(
    () => executor.connect({ pageEmail, honorific, speak: (text) => void speak(text) }),
    [pageEmail, honorific, speak],
  );

  // F1 polls for WhatsApp photos as this teacher, and speaks with Nemu's voice (#207).
  const registered = identity?.status === "registered";
  useEffect(
    () =>
      gradePhoto.connect({ pageEmail, honorific, registered, speak: (text) => void speak(text) }),
    [pageEmail, honorific, registered, speak],
  );
  // F3 runs an uploaded BPMN process as this teacher (#213), and records a new one (#214).
  useEffect(() => {
    processRun.connect({ pageEmail, honorific, speak: (text) => void speak(text) });
    recorder.connect({ pageEmail, honorific, speak: (text) => void speak(text) });
  }, [pageEmail, honorific, speak]);

  // A task under way in this tab carries on after a page load (F0-13).
  useEffect(() => {
    void executor.restore();
    void gradePhoto.restore();
    void recorder.restore();
  }, []);

  // Another account signed in: the previous teacher's answer goes (ID-04).
  useEffect(dismissAll, [identity, dismissAll]);

  // Nemu speaks the main sentence of each answer (F0-05).
  useEffect(() => {
    if (state.status === "answered") void speak(state.result.text);
  }, [state, speak]);

  // Closing Nemu silences it.
  useEffect(() => {
    if (!open) stop();
  }, [open, stop]);

  // "berhenti" closes Nemu, as it does when typed.
  useEffect(
    () =>
      voiceCommands.subscribe((event) => {
        if (event.type === "command" && event.command === "berhenti") {
          dismissAll();
          close();
        }
      }),
    [dismissAll, close],
  );

  return (
    <>
      <div
        className="pointer-events-none fixed right-6 bottom-6 z-[2147483647] flex flex-col items-end gap-3 font-sans"
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
      >
        {run.display ? (
          <div className="pointer-events-auto">
            <NemuStage display={run.display} target={run.target} />
          </div>
        ) : recording.display ? (
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            {talk.heard !== null && <HeardBubble text={talk.heard} />}
            <NemuStage display={withSpokenWord(recording.display, voice)} />
            {talk.state.phase === "listening" && <ListeningBubble />}
          </div>
        ) : grades.display ? (
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            {talk.heard !== null && <HeardBubble text={talk.heard} />}
            <NemuStage display={withSpokenWord(grades.display, voice)} />
            {talk.state.phase === "listening" && <ListeningBubble />}
            {grades.typing && <AskBox pending={false} onAsk={(text) => gradePhoto.hear(text)} />}
          </div>
        ) : process.display ? (
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            {talk.heard !== null && <HeardBubble text={talk.heard} />}
            <NemuStage display={withSpokenWord(process.display, voice)} />
            {talk.state.phase === "listening" && <ListeningBubble />}
            {process.typing && <AskBox pending={false} onAsk={(text) => processRun.hear(text)} />}
          </div>
        ) : preview.display ? (
          <div className="pointer-events-auto">
            <NemuStage display={preview.display} target={preview.target} />
          </div>
        ) : (
          open && (
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              <NemuPanel
                identity={identity}
                state={state}
                talk={talk.state}
                heard={talk.heard}
                voice={voice}
                action={nextAction}
                onAsk={askTyped}
                onRepeat={repeat}
                onRead={(text) => void speak(text)}
                onDismiss={dismissAll}
              />
              {run.hasNotes && !run.active && (
                <Button
                  type="button"
                  variant="link"
                  onClick={() => {
                    close();
                    executor.showNotes();
                  }}
                  className={`${NEMU_LINK} rounded-2xl bg-background px-3 shadow-nemu-float`}
                >
                  Lihat catatan langkah
                </Button>
              )}
              {registered && !run.active && (
                <Button
                  type="button"
                  variant="link"
                  onClick={() => startRecording("")}
                  className={`${NEMU_LINK} rounded-2xl bg-background px-3 shadow-nemu-float`}
                >
                  Rekam cara
                </Button>
              )}
            </div>
          )
        )}
        {!run.display &&
          !grades.display &&
          !process.active &&
          !preview.display &&
          !open &&
          grades.card && (
            <div className="pointer-events-auto">
              <NemuStage display={grades.card} />
            </div>
          )}
        <div className="pointer-events-auto">
          <NemuButton
            open={open}
            shortcutKeys={shortcutKeys(shortcut)}
            onToggle={() => setOpen((current) => !current)}
            onHoldStart={talk.press}
            onHoldEnd={talk.release}
          />
        </div>
      </div>
      <RowTicks elements={run.ticks} />
      {TEST_TOOLS_ENABLED && <ExecutorTestDock />}
      {PREVIEW_ENABLED && (
        <DisplayPreviewDock
          onShow={(scene) => {
            close();
            void preview.show(scene);
          }}
          onClose={preview.close}
        />
      )}
    </>
  );
}

type NemuPanelProps = {
  identity: IdentityResult | null;
  state: AskState;
  talk: TalkState;
  heard: string | null;
  voice: VoiceState | null;
  action: { label: string; onSelect: () => void } | undefined;
  onAsk: (question: string) => void;
  onRepeat: () => void;
  onRead: (text: string) => void;
  onDismiss: () => void;
};

/** One display at a time: a talk failure, else the answer (or its Skeleton). */
function NemuPanel({
  identity,
  state,
  talk,
  heard,
  voice,
  action,
  onAsk,
  onRepeat,
  onRead,
  onDismiss,
}: NemuPanelProps) {
  if (!identity) return <GelembungJawabSkeleton />;
  // ID-02: an unregistered or signed-out account gets the reason instead of the type box.
  if (identity.status !== "registered") return <GelembungJawab sentence={identity.message} />;
  return (
    <>
      {talk.phase === "transcribing" && <HeardBubble text={null} />}
      {heard !== null && <HeardBubble text={heard} />}
      {talk.phase === "failed" ? (
        <GelembungJawab sentence={talk.message} onClose={onDismiss} />
      ) : (
        <>
          {state.status === "asking" && <GelembungJawabSkeleton />}
          {state.status === "answered" && (
            <GelembungJawab
              sentence={state.result.text}
              highlightedWord={spokenWordIn(state.result.text, voice)}
              notes={
                state.result.kind === "answer"
                  ? {
                      kenapa: state.result.why,
                      sumber: state.result.sources,
                      sumberLink: state.result.diagram,
                    }
                  : undefined
              }
              action={action}
              onRead={onRead}
              onRepeat={onRepeat}
              onClose={onDismiss}
            />
          )}
        </>
      )}
      {talk.phase === "listening" && <ListeningBubble />}
      <AskBox pending={state.status === "asking"} onAsk={onAsk} />
    </>
  );
}
