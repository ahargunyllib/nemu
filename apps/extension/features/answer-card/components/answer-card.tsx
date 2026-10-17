import type { NemuResponse } from "@nemu/contracts";
import { Button } from "@nemu/ui/components/button";
import { Card, CardContent, CardFooter } from "@nemu/ui/components/card";
import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import { CalculationBreakdown } from "./calculation-breakdown";
import { CitationList } from "./citation-list";

const STATUS_LABELS: Record<NemuResponse["status"], string | undefined> = {
  answer: undefined,
  clarify: "Nemu butuh info tambahan",
  refuse: "Di luar cakupan Nemu",
  error: "Nemu gagal menjawab",
};

type AnswerCardProps = {
  response: NemuResponse;
  header: React.ReactNode;
  onReply: () => void;
};

export function AnswerCard({ response, header, onReply }: AnswerCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const statusLabel = STATUS_LABELS[response.status];
  const { detail } = response.answer;

  return (
    <Card size="sm" className="shadow-lg">
      {header}
      <CardContent className="flex flex-col gap-3">
        {statusLabel && (
          <p
            className={
              response.status === "error"
                ? "font-medium text-destructive"
                : "font-medium text-muted-foreground"
            }
          >
            {statusLabel}
          </p>
        )}
        <p className="text-sm">{response.answer.ringkas}</p>
        {detail && (
          <div className="flex flex-col items-start gap-1">
            <Button
              aria-expanded={detailOpen}
              size="xs"
              variant="link"
              className="px-0"
              onClick={() => setDetailOpen(!detailOpen)}
            >
              {detailOpen ? "Sembunyikan detail" : "Lihat detail"}
            </Button>
            {detailOpen && <p className="whitespace-pre-line">{detail}</p>}
          </div>
        )}
        <CalculationBreakdown calculations={response.calc} />
        {response.warnings.length > 0 && (
          <ul aria-label="Peringatan" className="flex flex-col gap-1">
            {response.warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-1.5 text-destructive">
                <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
                {warning}
              </li>
            ))}
          </ul>
        )}
        <CitationList citations={response.citations} />
      </CardContent>
      {response.status === "clarify" && (
        <CardFooter>
          <Button size="sm" onClick={onReply}>
            Jawab
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
