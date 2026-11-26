import { useCallback, useEffect, useState } from "react";

import { useIdentity } from "../../features/identity/hooks/use-identity";
import { usePageEmail } from "../../features/identity/hooks/use-page-email";
import type { IdentityResult } from "../../features/identity/lib/identity";
import {
  AnswerBubble,
  AnswerBubbleSkeleton,
} from "../../features/nemu-button/components/answer-bubble";
import { AskBox } from "../../features/nemu-button/components/ask-box";
import { NemuButton } from "../../features/nemu-button/components/nemu-button";
import { type AskState, useAsk } from "../../features/nemu-button/hooks/use-ask";
import { SpokenText } from "../../features/voice/components/spoken-text";
import { HeardBubble, ListeningBubble } from "../../features/voice/components/talk-bubbles";
import { useTalk } from "../../features/voice/hooks/use-talk";
import { useVoice, type VoiceState } from "../../features/voice/hooks/use-voice";
import type { TalkState } from "../../features/voice/lib/talk-machine";
import { shortcutKeys, TALK_SHORTCUT } from "../../features/voice/lib/talk-shortcut";
import { voiceCommands } from "../../features/voice/stores/voice-commands";

const SHORTCUT_KEYS = shortcutKeys(TALK_SHORTCUT);

/**
 * Everything Nemu draws on an allowed page (WS-03): the Nemu button and, once it is clicked or the
 * talk combination is held, the panel above it. Who Nemu helps follows the account signed in on
 * the page; Nemu speaks the main sentence of every answer.
 */
export function NemuApp() {
  const pageEmail = usePageEmail();
  const identity = useIdentity(pageEmail);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { state, ask, reset } = useAsk(pageEmail, close);
  const { voice, working, speak, repeat, stop } = useVoice(pageEmail);
  const talk = useTalk({
    pageEmail,
    shortcut: TALK_SHORTCUT,
    enabled: identity?.status === "registered",
    isWorking: () => working || voiceCommands.isWorking(),
    onStart: () => setOpen(true),
    onQuestion: (question) => void ask(question),
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
    <div
      className="pointer-events-none fixed right-6 bottom-6 z-[2147483647] flex flex-col items-end gap-3 font-sans"
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      {open && (
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <NemuPanel
            identity={identity}
            state={state}
            talk={talk.state}
            heard={talk.heard}
            voice={voice}
            onAsk={askTyped}
            onRepeat={repeat}
            onDismiss={dismissAll}
          />
        </div>
      )}
      <div className="pointer-events-auto">
        <NemuButton
          open={open}
          shortcutKeys={SHORTCUT_KEYS}
          onToggle={() => setOpen((current) => !current)}
          onHoldStart={talk.press}
          onHoldEnd={talk.release}
        />
      </div>
    </div>
  );
}

type NemuPanelProps = {
  identity: IdentityResult | null;
  state: AskState;
  talk: TalkState;
  heard: string | null;
  voice: VoiceState | null;
  onAsk: (question: string) => void;
  onRepeat: () => void;
  onDismiss: () => void;
};

function NemuPanel({
  identity,
  state,
  talk,
  heard,
  voice,
  onAsk,
  onRepeat,
  onDismiss,
}: NemuPanelProps) {
  if (!identity) return <AnswerBubbleSkeleton />;
  // ID-02: an unregistered or signed-out account gets the reason instead of the type box.
  if (identity.status !== "registered") return <AnswerBubble text={identity.message} />;
  return (
    <>
      {talk.phase === "transcribing" && <HeardBubble text={null} />}
      {heard !== null && <HeardBubble text={heard} />}
      {state.status === "asking" && <AnswerBubbleSkeleton />}
      {state.status === "answered" && (
        <AnswerBubble
          text={state.result.text}
          sources={state.result.kind === "answer" ? state.result.sources : []}
          onClose={onDismiss}
        >
          <SpokenText text={state.result.text} voice={voice} onRepeat={onRepeat} />
        </AnswerBubble>
      )}
      {talk.phase === "failed" && <AnswerBubble text={talk.message} onClose={onDismiss} />}
      {talk.phase === "listening" && <ListeningBubble />}
      <AskBox pending={state.status === "asking"} onAsk={onAsk} />
    </>
  );
}
