import type { GroundedAnswer } from "@nemu/contracts/school";
import { Badge } from "@nemu/ui/components/badge";
import { Button } from "@nemu/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { Checkbox } from "@nemu/ui/components/checkbox";
import { Label } from "@nemu/ui/components/label";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { Spinner } from "@nemu/ui/components/spinner";
import { Textarea } from "@nemu/ui/components/textarea";
import { useMutation, useQueries } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { listDocumentsQueryOptions } from "@/features/documents/api/list-documents";
import { orpc } from "@/shared/api/orpc";

/**
 * WS-09: ask what a teacher would ask and see Nemu's answer and sources as if the ticked inactive
 * documents were already active. Active knowledge is always included.
 */
export default function TryAnswerPanel() {
  const [question, setQuestion] = useState("");
  // Untouched, every inactive document is tried; once the operator ticks, only the ticked ones.
  const [picked, setPicked] = useState<string[] | null>(null);
  const lists = useQueries({
    queries: [listDocumentsQueryOptions(null), listDocumentsQueryOptions("alursekolah")],
  });
  const loaded = lists.every((list) => list.data);
  const inactive = lists
    .flatMap((list) => list.data ?? [])
    .filter((document) => !document.isActive && document.status === "ready");
  const selected = picked ?? inactive.map((document) => document.id);
  const tryAnswer = useMutation(
    orpc.helpTryAnswer.mutationOptions({ onError: (error) => toast.error(error.message) }),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Pertanyaan</CardTitle>
          <CardDescription>Tulis seperti guru bertanya kepada Nemu.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (question.trim()) tryAnswer.mutate({ question, documentIds: selected });
            }}
          >
            <Textarea
              aria-label="Pertanyaan"
              placeholder="Setoran minimal berapa ayat?"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <div className="grid gap-2">
              <Label>Dokumen belum aktif yang ikut diuji</Label>
              {!loaded ? (
                <Skeleton className="h-16 w-full" />
              ) : inactive.length === 0 ? (
                <p className="text-muted-foreground">
                  Semua dokumen sudah aktif. Unggah dokumen dengan "Langsung aktif" mati untuk
                  mengujinya di sini.
                </p>
              ) : (
                inactive.map((document) => (
                  <Label key={document.id} className="flex items-center gap-2 font-normal">
                    <Checkbox
                      checked={selected.includes(document.id)}
                      onCheckedChange={(checked) =>
                        setPicked(
                          checked
                            ? [...selected, document.id]
                            : selected.filter((id) => id !== document.id),
                        )
                      }
                    />
                    {document.title}
                    <span className="text-muted-foreground">versi {document.version}</span>
                  </Label>
                ))
              )}
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={!question.trim() || tryAnswer.isPending}>
                {tryAnswer.isPending && <Spinner />}
                Uji jawaban
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <AnswerCard pending={tryAnswer.isPending} answer={tryAnswer.data} />
    </div>
  );
}

function AnswerCard({ pending, answer }: { pending: boolean; answer: GroundedAnswer | undefined }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Jawaban Nemu</CardTitle>
        <CardDescription>Yang akan didengar guru, dengan sumbernya.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {pending ? (
          <div className="grid gap-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ) : !answer ? (
          <p className="text-muted-foreground">Belum ada pertanyaan yang diuji.</p>
        ) : (
          <>
            <div className="flex items-start gap-2">
              <Badge variant={answer.status === "answered" ? "default" : "secondary"}>
                {answer.status === "answered" ? "Terjawab" : "Belum ada di panduan"}
              </Badge>
            </div>
            <p className="text-base">{answer.answer}</p>
            {answer.status === "answered" && (
              <div className="grid gap-2">
                <span className="font-medium">Sumber</span>
                {answer.citations.map((citation) => (
                  <div key={citation.chunkId} className="rounded-2xl bg-muted p-3">
                    <div className="font-medium">
                      {citation.title}
                      {citation.article && ` · ${citation.article}`}
                      {citation.page !== null && ` · hlm. ${citation.page}`}
                    </div>
                    <div className="text-muted-foreground">"{citation.quote}"</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
