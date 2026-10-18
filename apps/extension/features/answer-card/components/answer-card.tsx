import type { NemuResponse } from "@nemu/contracts";
import { Badge } from "@nemu/ui/components/badge";
import { Button } from "@nemu/ui/components/button";
import { Card, CardContent, CardFooter } from "@nemu/ui/components/card";
import { NemuButton } from "@nemu/ui/nemu/nemu-button";
import { CalendarClockIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import { type AnswerCardKicker, AnswerCardKickerContext } from "../contexts/answer-card-kicker";
import { pertanggungjawabanDeadline } from "../lib/calculation";
import { CARD_BODY, CARD_TITLE } from "../lib/typography";
import { CalculationBreakdown } from "./calculation-breakdown";
import { CitationList } from "./citation-list";

const STATUS_KICKERS: Record<NemuResponse["status"], AnswerCardKicker> = {
  answer: { label: "Jawaban", tone: "nemu", mascot: "idle" },
  clarify: { label: "Nemu butuh info tambahan", tone: "nemu", mascot: "thinking" },
  refuse: { label: "Di luar cakupan Nemu", tone: "danger", mascot: "warning" },
  error: { label: "Nemu gagal menjawab", tone: "danger", mascot: "warning" },
};

type AnswerCardProps = {
  response: NemuResponse;
  header: React.ReactNode;
  onReply: () => void;
  /** What happened after the answer, such as the task's new status once the user pressed Kirim. */
  children?: React.ReactNode;
};

/**
 * Tingkat 1 (Jawaban ringkas): the short answer, its calculation and citations. "Rincian" opens it
 * up to Tingkat 2 with the detail; warnings always show, since they change what the user does.
 */
export function AnswerCard({ response, header, onReply, children }: AnswerCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const { detail } = response.answer;
  const deadline = pertanggungjawabanDeadline(response.calc);
  const clarify = response.status === "clarify";

  return (
    <Card size="sm" className={`shadow-lg ${CARD_BODY}`}>
      <AnswerCardKickerContext value={STATUS_KICKERS[response.status]}>
        {header}
        <CardContent className="flex flex-col gap-3">
          <p className={CARD_TITLE}>{response.answer.ringkas}</p>
          {deadline && (
            <Badge variant="destructive">
              <CalendarClockIcon data-icon="inline-start" />
              Batas {deadline}
            </Badge>
          )}
          <CalculationBreakdown calculations={response.calc} />
          {detail && detailOpen && <p className="whitespace-pre-line">{detail}</p>}
          {children}
          {response.warnings.length > 0 && (
            <ul
              aria-label="Peringatan"
              className="flex flex-col gap-1 rounded-xl bg-nemu-danger-subtle px-3 py-2 text-destructive"
            >
              {response.warnings.map((warning) => (
                <li key={warning} className="flex items-start gap-1.5">
                  <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
                  {warning}
                </li>
              ))}
            </ul>
          )}
          <CitationList citations={response.citations} />
        </CardContent>
        {(detail || clarify) && (
          <CardFooter className="gap-2">
            {detail && (
              <NemuButton
                tone="link"
                size="sm"
                aria-expanded={detailOpen}
                aria-label={detailOpen ? "Tutup rincian" : undefined}
                className="text-[13px]/[16px]"
                onClick={() => setDetailOpen(!detailOpen)}
              >
                {detailOpen ? "Tutup" : "Rincian"}
              </NemuButton>
            )}
            {clarify && (
              <Button size="sm" className="ml-auto" onClick={onReply}>
                Jawab
              </Button>
            )}
          </CardFooter>
        )}
      </AnswerCardKickerContext>
    </Card>
  );
}
