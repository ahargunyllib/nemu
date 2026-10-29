import type { NemuResponse } from "@nemu/contracts";
import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { copyableValue } from "../lib/calculation";
import { asSentence } from "../lib/sentence";
import { AnswerCardFrame } from "./answer-card-frame";
import { CalculationBreakdown } from "./calculation-breakdown";
import { CopyValue } from "./copy-value";
import { SourceLine } from "./source-line";
import { TextLink } from "./text-link";

type AnswerCardProps = {
  response: NemuResponse;
  header: React.ReactNode;
  /** Above the answer, beside the ×: the guide's progress, such as "Langkah 2 dari 6". */
  kicker?: React.ReactNode;
  /** The Isi strip while a confirmed `fill` step waits; such an answer never offers Salin. */
  fill?: React.ReactNode;
  /** What happened after the answer, such as the task's new status after Kirim. */
  children?: React.ReactNode;
  /** Balas: the Composer pill, to ask again from the card. */
  reply?: React.ReactNode;
};

/**
 * Jawaban teks: the answer as plain text, like a chatbot message, with its warnings as sentences
 * and the computed value to copy or fill in. "Rincian" opens the rest: the detail, each
 * calculation's formula, and the sources.
 */
export function AnswerCard({ response, header, kicker, fill, children, reply }: AnswerCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const { detail } = response.answer;
  const fillsValue = response.actions.some((action) => action.type === "fill");
  const value = fillsValue ? undefined : copyableValue(response.calc);
  const sources = [...new Set(response.calc.flatMap(({ sumber }) => (sumber ? [sumber] : [])))];
  const hasDetail = Boolean(detail) || response.calc.length > 0 || response.citations.length > 0;

  return (
    <AnswerCardFrame header={header} kicker={kicker} lead={<p>{response.answer.ringkas}</p>}>
      {response.warnings.length > 0 && (
        <ul aria-label="Peringatan" className="flex flex-col gap-1">
          {response.warnings.map((warning) => (
            <li key={warning}>{asSentence(warning)}</li>
          ))}
        </ul>
      )}
      {fill}
      {value && <CopyValue value={value} />}
      {children}
      {hasDetail && (
        <p>
          <TextLink aria-expanded={detailOpen} onClick={() => setDetailOpen(!detailOpen)}>
            {detailOpen ? "Tutup rincian" : "Rincian"}
            <ChevronRightIcon aria-hidden className="ml-0.5 inline size-3.5 align-[-2px]" />
          </TextLink>
        </p>
      )}
      {hasDetail && detailOpen && (
        <div className="flex flex-col gap-1.5 rounded-xl bg-muted px-3 py-2.5">
          {detail && <p className="whitespace-pre-line">{detail}</p>}
          <CalculationBreakdown calculations={response.calc} />
          <SourceLine citations={response.citations} sources={sources} />
        </div>
      )}
      {reply}
    </AnswerCardFrame>
  );
}
