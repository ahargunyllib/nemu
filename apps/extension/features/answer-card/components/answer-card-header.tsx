import { Button } from "@nemu/ui/components/button";
import { CardAction, CardDescription, CardHeader } from "@nemu/ui/components/card";
import { XIcon } from "lucide-react";

import type { AnswerCardKicker } from "../contexts/answer-card-kicker";
import { useAnswerCardKicker } from "../hooks/use-answer-card-kicker";
import { CAPTION, LABEL_CAPS } from "../lib/typography";
import { MascotIcon } from "./mascot-icon";

const KICKER_TONES: Record<AnswerCardKicker["tone"], string> = {
  nemu: "text-nemu-text",
  success: "text-nemu-success-text",
  danger: "text-destructive",
};

/** The kicker row (tiny mascot and the card's state), the question asked, and the close ×. */
export function AnswerCardHeader({ prompt, onClose }: { prompt: string; onClose: () => void }) {
  const kicker = useAnswerCardKicker();

  return (
    <CardHeader className="gap-1">
      <p className={`flex items-center gap-1.5 ${LABEL_CAPS} ${KICKER_TONES[kicker.tone]}`}>
        <MascotIcon state={kicker.mascot} className="size-4" />
        {kicker.label}
      </p>
      <CardDescription className={`line-clamp-2 ${CAPTION}`}>{prompt}</CardDescription>
      <CardAction>
        <Button aria-label="Tutup" size="icon-xs" variant="ghost" onClick={onClose}>
          <XIcon />
        </Button>
      </CardAction>
    </CardHeader>
  );
}
