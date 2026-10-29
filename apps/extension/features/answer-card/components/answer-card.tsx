import type { NemuResponse } from "@nemu/contracts";
import { useState } from "react";

import { copyableValue } from "../lib/calculation";
import { asSentence } from "../lib/sentence";
import { AnswerCardFrame } from "./answer-card-frame";
import { CalculationBreakdown } from "./calculation-breakdown";
import { CitationList } from "./citation-list";
import { CopyValue } from "./copy-value";
import { TextLink } from "./text-link";

type AnswerCardProps = {
  response: NemuResponse;
  header: React.ReactNode;
  /** What happened after the answer, such as the steps or the task's new status after Kirim. */
  children?: React.ReactNode;
  /** Balas: the Composer pill, to ask again from the card. */
  reply?: React.ReactNode;
};

/**
 * Jawaban teks: the answer as plain text, like a chatbot message, with its calculation and
 * warnings as sentences, the computed value to copy, and its sources. "Rincian" opens the detail.
 */
export function AnswerCard({ response, header, children, reply }: AnswerCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const { detail } = response.answer;
  const value = copyableValue(response.calc);
  const sources = [...new Set(response.calc.flatMap(({ sumber }) => (sumber ? [sumber] : [])))];

  return (
    <AnswerCardFrame header={header} lead={<p>{response.answer.ringkas}</p>}>
      <CalculationBreakdown calculations={response.calc} />
      {response.warnings.length > 0 && (
        <ul aria-label="Peringatan" className="flex flex-col gap-1">
          {response.warnings.map((warning) => (
            <li key={warning}>{asSentence(warning)}</li>
          ))}
        </ul>
      )}
      {value && <CopyValue value={value} />}
      {children}
      {detail && detailOpen && (
        <div className="flex flex-col gap-1">
          <p className="whitespace-pre-line">{detail}</p>
          {sources.map((source) => (
            <p key={source} className="text-muted-foreground">
              Tarif: {source}
            </p>
          ))}
        </div>
      )}
      {detail && (
        <p>
          <TextLink aria-expanded={detailOpen} onClick={() => setDetailOpen(!detailOpen)}>
            {detailOpen ? "Tutup rincian" : "Rincian"}
          </TextLink>
        </p>
      )}
      <CitationList citations={response.citations} sources={sources} />
      {reply}
    </AnswerCardFrame>
  );
}
