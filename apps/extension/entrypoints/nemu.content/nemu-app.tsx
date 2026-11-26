import { GelembungJawab, GelembungJawabSkeleton } from "@nemu/ui/nemu/gelembung-jawab";
import { NemuStage } from "@nemu/ui/nemu/nemu-stage";
import { useCallback, useEffect, useState } from "react";

import { DisplayPreviewDock } from "../../features/display-preview/components/display-preview-dock";
import { useDisplayPreview } from "../../features/display-preview/hooks/use-display-preview";
import { PREVIEW_ENABLED } from "../../features/display-preview/lib/preview-scenes";
import { useIdentity } from "../../features/identity/hooks/use-identity";
import { usePageEmail } from "../../features/identity/hooks/use-page-email";
import type { IdentityResult } from "../../features/identity/lib/identity";
import { AskBox } from "../../features/nemu-button/components/ask-box";
import { NemuButton } from "../../features/nemu-button/components/nemu-button";
import { type AskState, useAsk } from "../../features/nemu-button/hooks/use-ask";

/**
 * Everything Nemu draws on an allowed page (WS-03): the Nemu button and, once it is clicked, the
 * type box under the Gelembung Jawab. Who Nemu helps follows the account signed in on the page.
 * Only one of the five display types shows at a time (PRD §6.2).
 */
export function NemuApp() {
  const pageEmail = usePageEmail();
  const identity = useIdentity(pageEmail);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { state, ask, reset } = useAsk(pageEmail, close);
  const preview = useDisplayPreview();

  // Another account signed in: the previous teacher's answer goes (ID-04).
  useEffect(reset, [identity, reset]);

  return (
    <>
      <div
        className="pointer-events-none fixed right-6 bottom-6 z-[2147483647] flex flex-col items-end gap-3 font-sans"
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
      >
        {preview.display ? (
          <div className="pointer-events-auto">
            <NemuStage display={preview.display} target={preview.target} />
          </div>
        ) : (
          open && (
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              <NemuPanel identity={identity} state={state} onAsk={ask} onDismiss={reset} />
            </div>
          )
        )}
        <div className="pointer-events-auto">
          <NemuButton open={open} onToggle={() => setOpen((current) => !current)} />
        </div>
      </div>
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
  onAsk: (question: string) => void;
  onDismiss: () => void;
};

function NemuPanel({ identity, state, onAsk, onDismiss }: NemuPanelProps) {
  if (!identity) return <GelembungJawabSkeleton />;
  // ID-02: an unregistered or signed-out account gets the reason instead of the type box.
  if (identity.status !== "registered") return <GelembungJawab sentence={identity.message} />;
  return (
    <>
      {state.status === "asking" && <GelembungJawabSkeleton />}
      {state.status === "answered" && (
        <GelembungJawab
          sentence={state.result.text}
          notes={state.result.kind === "answer" ? { sumber: state.result.sources } : undefined}
          onClose={onDismiss}
        />
      )}
      <AskBox pending={state.status === "asking"} onAsk={onAsk} />
    </>
  );
}
