import { Card } from "@nemu/ui/components/card";

import { CARD_BODY } from "../lib/typography";

type AnswerCardFrameProps = Omit<React.ComponentProps<typeof Card>, "className"> & {
  /** The close × from the overlay, beside the first line. */
  header: React.ReactNode;
  /** The first paragraph, which the × sits beside. */
  lead: React.ReactNode;
};

/**
 * Jawaban teks (docs/design-system.md, "Answers"): a white 280px card that reads like a chatbot
 * message, 14px corners, a 1px border, 12px padding (14px on the left) and 10px between lines.
 */
export function AnswerCardFrame({ header, lead, children, ...props }: AnswerCardFrameProps) {
  return (
    <Card
      className={`gap-2.5 rounded-[14px] border py-3 pr-3 pl-3.5 shadow-nemu-float ring-0 ${CARD_BODY}`}
      {...props}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">{lead}</div>
        {header}
      </div>
      {children}
    </Card>
  );
}
