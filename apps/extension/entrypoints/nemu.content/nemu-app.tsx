import type { PageSnapshot } from "@nemu/contracts/school";
import { shortcutKeys } from "@nemu/contracts/talk-shortcut";
import type { NemuChoice, NemuDisplay, NemuSource } from "@nemu/ui/lib/nemu-display";
import { GelembungJawab, GelembungJawabSkeleton } from "@nemu/ui/nemu/gelembung-jawab";
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
import { currentRequestPage, operatorRequest } from "../../features/identity/lib/operator-request";
import { useNextAction } from "../../features/ini-kenapa/hooks/use-next-action";
import { readPageSnapshot } from "../../features/ini-kenapa/lib/page-snapshot";
import { requestSourceFile } from "../../features/nemu-button/api/request-source";
import { AskBox } from "../../features/nemu-button/components/ask-box";
import { useProcessRun } from "../../features/process-run/hooks/use-process-run";
import { processRun } from "../../features/process-run/stores/process-run";
import { useQuizCheck } from "../../features/quiz-check/hooks/use-quiz-check";
import { quizCheck } from "../../features/quiz-check/stores/quiz-check";
import { useQuizDelete } from "../../features/quiz-delete/hooks/use-quiz-delete";
import { quizDelete } from "../../features/quiz-delete/stores/quiz-delete";
import { useQuizImport } from "../../features/quiz-import/hooks/use-quiz-import";
import { quizImport } from "../../features/quiz-import/stores/quiz-import";
import { useRecorder } from "../../features/recorder/hooks/use-recorder";
import { recorder } from "../../features/recorder/stores/recorder";
import { NemuButton } from "../../features/nemu-button/components/nemu-button";
import { type AskState, useAsk } from "../../features/nemu-button/hooks/use-ask";
import type { SourceFile } from "../../features/nemu-button/lib/answer";
import { MicrophoneDisplay } from "../../features/voice/components/microphone-display";
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
  // F1·12a: a click on the Nemu button first asks what to open.
  const [menu, setMenu] = useState(false);
  const close = useCallback(() => {
    setOpen(false);
    setMenu(false);
  }, []);
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
  const startQuizCheck = useCallback(
    (utterance: string) => {
      close();
      void quizCheck.start(utterance);
    },
    [close],
  );
  const startQuizDelete = useCallback(
    (utterance: string) => {
      close();
      void quizDelete.start(utterance);
    },
    [close],
  );
  const startQuizImport = useCallback(
    (utterance: string) => {
      close();
      quizImport.start(utterance);
    },
    [close],
  );
  const { state, ask, reset } = useAsk(
    pageEmail,
    close,
    startGrades,
    startProcess,
    startRecording,
    startQuizCheck,
    startQuizDelete,
    startQuizImport,
  );
  const preview = useDisplayPreview();
  const { voice, working, speak, repeat, stop } = useVoice(pageEmail);
  // When the Nemu Service refuses, Nemu says why instead of opening an empty tab.
  const openSource = useCallback(
    (file: SourceFile) => {
      void requestSourceFile(pageEmail, file).then((result) => {
        if ("notice" in result) void speak(result.notice);
      });
    },
    [pageEmail, speak],
  );
  const run = useExecutor();
  // "ini kenapa?" reads the page as it was when the talk combination went down (F2-01).
  const pressSnapshot = useRef<PageSnapshot | null>(null);
  const grades = useGradePhoto();
  const process = useProcessRun();
  const recording = useRecorder();
  const quiz = useQuizCheck();
  const quizDeletion = useQuizDelete();
  const importing = useQuizImport();
  const talk = useTalk({
    pageEmail,
    shortcut,
    enabled: identity?.status === "registered",
    honorific: identity?.status === "registered" ? identity.honorific : "",
    isWorking: () => working || voiceCommands.isWorking(),
    onStart: () => {
      pressSnapshot.current = readPageSnapshot(document, location.href);
      recorder.talkStarted();
      setMenu(false);
      setOpen(true);
    },
    // While F1, F3 or F4-06 waits for an answer (a photo question, a number, a choice), the words
    // are that answer.
    // While "Rekam cara" records, the words are the operator's narration.
    onAnswer: (words) =>
      recorder.narrate(words) ||
      gradePhoto.hear(words) ||
      processRun.hear(words) ||
      quizDelete.hear(words) ||
      quizImport.hear(words),
    onQuestion: (question) => void ask(question, pressSnapshot.current),
  });
  const { dismiss } = talk;
  const speakLine = useCallback((text: string) => void speak(text), [speak]);

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

  // F1·12a: "Mau buka apa, Bu?" when the Nemu button has more than the type box to offer: the
  // site's kept Catatan langkah, and for the school's operator "Rekam cara" (F3-01).
  const operator = identity?.status === "registered" && identity.operator === true;
  const menuDisplay = useMemo(
    () =>
      nemuMenu({
        honorific,
        keys: shortcutKeys(shortcut),
        notes: identity?.status === "registered" && !run.active ? run.notesCount : 0,
        operator: operator && !run.active,
        onChoose: (choice) => {
          setMenu(false);
          if (choice === "notes") executor.showNotes();
          else if (choice === "record") startRecording("");
          else setOpen(true);
        },
        onClose: () => setMenu(false),
      }),
    [honorific, shortcut, identity, run.active, run.notesCount, operator, startRecording],
  );
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
    // F4-01 checks a Moodle quiz as this teacher (#209); F4-03 puts her script into one (#210).
    quizCheck.connect({ pageEmail, honorific, speak: (text) => void speak(text) });
    // F4-06 warns before she deletes a quiz students took (#211).
    quizDelete.connect({ honorific, speak: (text) => void speak(text) });
    quizImport.connect({ pageEmail, honorific, speak: (text) => void speak(text) });
  }, [pageEmail, honorific, speak]);

  // A task under way in this tab carries on after a page load (F0-13).
  useEffect(() => {
    void executor.restore();
    void gradePhoto.restore();
    void recorder.restore();
    void quizCheck.restore();
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
        {talk.state.phase === "asking" || talk.state.phase === "blocked" ? (
          // The microphone comes first: nothing else can go on until Nemu can hear (PRD v2.3).
          <MicrophoneDisplay
            phase={talk.state.phase}
            honorific={honorific}
            onClose={dismiss}
            speak={speakLine}
          />
        ) : run.display ? (
          <div className="pointer-events-auto">
            <NemuStage display={run.display} target={run.target} />
          </div>
        ) : quiz.display ? (
          <div className="pointer-events-auto">
            <NemuStage display={withSpokenWord(quiz.display, voice)} target={quiz.target} />
          </div>
        ) : quizDeletion.display ? (
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            {talk.heard !== null && <HeardBubble text={talk.heard} />}
            <NemuStage
              display={withSpokenWord(quizDeletion.display, voice)}
              target={quizDeletion.target}
            />
            {talk.state.phase === "listening" && <ListeningBubble />}
          </div>
        ) : importing.display ? (
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            {talk.heard !== null && <HeardBubble text={talk.heard} />}
            <NemuStage display={withSpokenWord(importing.display, voice)} />
            {talk.state.phase === "listening" && <ListeningBubble />}
            {importing.typing && <AskBox pending={false} onAsk={(text) => quizImport.hear(text)} />}
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
        ) : menu && menuDisplay ? (
          <div className="pointer-events-auto">
            <NemuStage display={menuDisplay} />
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
                onOpenSource={openSource}
                onDismiss={dismissAll}
              />
            </div>
          )
        )}
        {!run.display &&
          !grades.display &&
          !process.active &&
          !preview.display &&
          !quiz.display &&
          !quizDeletion.display &&
          !importing.display &&
          !open &&
          !menu &&
          grades.card && (
            <div className="pointer-events-auto">
              <NemuStage display={grades.card} />
            </div>
          )}
        <div className="pointer-events-auto">
          <NemuButton
            open={open || menu}
            shortcutKeys={shortcutKeys(shortcut)}
            onToggle={() => {
              if (open || menu) return close();
              if (menuDisplay) setMenu(true);
              else setOpen(true);
            }}
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

type MenuChoice = "notes" | "ask" | "record";

/**
 * The Nemu button's menu (F1·12a): Catatan langkah with how many the site keeps, Tanya Nemu with
 * the talk combination, and Rekam cara for the operator. Null when only Tanya Nemu is left, so
 * the button opens the type box straight away.
 */
function nemuMenu(input: {
  honorific: string;
  keys: readonly string[];
  notes: number;
  operator: boolean;
  onChoose: (choice: MenuChoice) => void;
  onClose: () => void;
}): NemuDisplay | null {
  const choices: (NemuChoice & { id: MenuChoice })[] = [
    ...(input.notes > 0
      ? [{ id: "notes" as const, label: `Catatan langkah · ${input.notes} tersimpan` }]
      : []),
    { id: "ask", label: `Tanya Nemu (${input.keys.join(" + ")})` },
    ...(input.operator ? [{ id: "record" as const, label: "Rekam cara" }] : []),
  ];
  const [first, second, third] = choices;
  if (!first || !second) return null;
  return {
    type: "pilih",
    status: { text: "Nemu" },
    question: input.honorific ? `Mau buka apa, ${input.honorific}?` : "Mau buka apa?",
    choices: third ? [first, second, third] : [first, second],
    onChoose: (id) => input.onChoose(id as MenuChoice),
    onClose: input.onClose,
  };
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
  onOpenSource: (file: SourceFile) => void;
  onDismiss: () => void;
};

/** Sumber's list: a cited PDF opens at its page (#258); other sources stay text. */
function sumberEntries(
  sources: readonly string[],
  files: readonly SourceFile[] | undefined,
  onOpen: (file: SourceFile) => void,
): NemuSource[] {
  return sources.map((label) => {
    const file = files?.find((candidate) => candidate.label === label);
    return file ? { label, onOpen: () => onOpen(file) } : label;
  });
}

/** One display at a time: a talk notice, else the answer (or its Skeleton). */
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
  onOpenSource,
  onDismiss,
}: NemuPanelProps) {
  if (!identity) return <GelembungJawabSkeleton />;
  // ID-02: an unregistered or signed-out account gets the reason instead of the type box.
  if (identity.status !== "registered") {
    const request = operatorRequest(identity, currentRequestPage(document, window.location));
    return (
      <GelembungJawab
        sentence={identity.message}
        action={
          request && {
            label: request.label,
            onSelect: () => void window.open(request.url, "_blank", "noopener"),
          }
        }
      />
    );
  }
  return (
    <>
      {talk.phase === "transcribing" && <HeardBubble text={null} />}
      {heard !== null && <HeardBubble text={heard} />}
      {talk.phase === "notice" ? (
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
                      sumber: sumberEntries(state.result.sources, state.result.files, onOpenSource),
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
