import type { HelpExplanation } from "@nemu/contracts/school";

import { type AskResult, sourceLabel } from "../../nemu-button/lib/answer";
import { processDiagramUrl } from "./process-diagram";
import { whatsAppUrl } from "./whatsapp";

/**
 * What Nemu offers after explaining an error (F2): to show the teacher how to fix it herself
 * (cara 2, by the Kamus Kendala entry), or to open a ready WhatsApp message to whoever can fix it.
 */
export type AnswerNext =
  | {
      kind: "fix";
      /** The control to point at, by the name the page shows ("Sinkro Ruang GTK"). */
      target: string;
      /** The kamus sentence that says how, which may name the menu it is under. */
      how: string;
      entryId: string;
    }
  | { kind: "whatsapp"; label: string; url: string };

/** Said instead of reading a page with a password field on screen (F2-07). */
export const PASSWORD_ON_SCREEN =
  "Ada kolom kata sandi di layar, jadi Nemu tidak membaca atau mengirim apa pun dari halaman ini.";

/** helpExplain's answer as the Gelembung Jawab: sentence, Kenapa?, Sumber and one next step. */
export function fromExplanation(explanation: HelpExplanation): AskResult {
  if (explanation.status === "grades_not_saved") {
    return { kind: "answer", text: explanation.sentence, sources: [] };
  }
  if (explanation.status === "process") {
    // F2-08: Sumber is the process in 2–4 steps; the one action is the reply to the parent.
    return {
      kind: "answer",
      text: explanation.sentence,
      detail: explanation.detail,
      why: explanation.why || undefined,
      sources: explanation.steps.map((step) => step.text),
      diagram: {
        label: `Lihat diagram ${explanation.process.title}`,
        href: processDiagramUrl(explanation),
      },
      next: explanation.parentReply
        ? {
            kind: "whatsapp",
            label: "Buka balasan untuk orang tua",
            url: whatsAppUrl({ phone: null, text: explanation.parentReply }),
          }
        : undefined,
    };
  }
  if (explanation.status === "not_in_guide") {
    const to = explanation.offerOperator;
    return {
      kind: "answer",
      text: explanation.sentence,
      sources: [],
      next:
        to && explanation.waDraft
          ? {
              kind: "whatsapp",
              label: `Ya, tanyakan ke ${to.name}`,
              url: whatsAppUrl(explanation.waDraft),
            }
          : undefined,
    };
  }
  const next: AnswerNext | undefined =
    explanation.canSelfFix && explanation.guidedTarget
      ? {
          kind: "fix",
          target: explanation.guidedTarget,
          how: explanation.citation.quote,
          entryId: explanation.entryId,
        }
      : explanation.waDraft && explanation.fixer
        ? {
            kind: "whatsapp",
            label: `Buka WhatsApp ke ${explanation.fixer.name}`,
            url: whatsAppUrl(explanation.waDraft),
          }
        : undefined;
  return {
    kind: "answer",
    text: explanation.sentence,
    detail: explanation.detail,
    why: explanation.why || undefined,
    sources: [sourceLabel(explanation.citation)],
    next,
  };
}
