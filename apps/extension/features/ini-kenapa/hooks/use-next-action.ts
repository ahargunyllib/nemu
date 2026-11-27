import { useMemo } from "react";

import { executor } from "../../executor/stores/executor";
import type { AnswerNext } from "../lib/explanation";
import { guidedFixTask } from "../lib/guided-fix";

/**
 * The Gelembung Jawab's one action after "ini kenapa?" (F2-04/05): "Tunjukkan caranya" starts cara
 * 2, where Nemu points and the teacher clicks; the WhatsApp button opens the ready message in a new
 * tab, where the teacher presses Kirim. `onFix` closes the panel so the pointing shows alone.
 */
export function useNextAction(next: AnswerNext | undefined, onFix: () => void) {
  return useMemo(() => {
    if (!next) return undefined;
    if (next.kind === "fix")
      return {
        label: "Tunjukkan caranya",
        onSelect: () => {
          onFix();
          void executor.start(guidedFixTask(document, next), { cara: 2 });
        },
      };
    return {
      label: next.label,
      onSelect: () => void window.open(next.url, "_blank", "noopener"),
    };
  }, [next, onFix]);
}
