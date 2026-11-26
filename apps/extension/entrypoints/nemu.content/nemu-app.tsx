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

/**
 * Everything Nemu draws on an allowed page (WS-03): the Nemu button and, once it is clicked, the
 * type box under the Gelembung Jawab. Who Nemu helps follows the account signed in on the page.
 */
export function NemuApp() {
  const pageEmail = usePageEmail();
  const identity = useIdentity(pageEmail);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { state, ask, reset } = useAsk(pageEmail, close);

  // Another account signed in: the previous teacher's answer goes (ID-04).
  useEffect(reset, [identity, reset]);

  return (
    <div
      className="pointer-events-none fixed right-6 bottom-6 z-[2147483647] flex flex-col items-end gap-3 font-sans"
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      {open && (
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <NemuPanel identity={identity} state={state} onAsk={ask} onDismiss={reset} />
        </div>
      )}
      <div className="pointer-events-auto">
        <NemuButton open={open} onToggle={() => setOpen((current) => !current)} />
      </div>
    </div>
  );
}

type NemuPanelProps = {
  identity: IdentityResult | null;
  state: AskState;
  onAsk: (question: string) => void;
  onDismiss: () => void;
};

function NemuPanel({ identity, state, onAsk, onDismiss }: NemuPanelProps) {
  if (!identity) return <AnswerBubbleSkeleton />;
  // ID-02: an unregistered or signed-out account gets the reason instead of the type box.
  if (identity.status !== "registered") return <AnswerBubble text={identity.message} />;
  return (
    <>
      {state.status === "asking" && <AnswerBubbleSkeleton />}
      {state.status === "answered" && (
        <AnswerBubble
          text={state.result.text}
          sources={state.result.kind === "answer" ? state.result.sources : []}
          onClose={onDismiss}
        />
      )}
      <AskBox pending={state.status === "asking"} onAsk={onAsk} />
    </>
  );
}
