import { Skeleton } from "@nemu/ui/components/skeleton";
import { Spinner } from "@nemu/ui/components/spinner";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@nemu/ui/components/input-group";
import { useMutation } from "@tanstack/react-query";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/shared/api/orpc";

/**
 * "Uji jawaban sebelum diaktifkan" (WS-09 for one BPMN): a question as a teacher would ask it,
 * the element Nemu traces it to in this file, and the first thing she would hear.
 */
export default function ProcessAnswerTest({ documentId }: { documentId: string }) {
  const [question, setQuestion] = useState("");
  const test = useMutation(
    orpc.helpTryProcess.mutationOptions({ onError: (error) => toast.error(error.message) }),
  );

  return (
    <div className="grid gap-2">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (question.trim()) test.mutate({ documentId, question });
        }}
      >
        <InputGroup>
          <InputGroupInput
            aria-label="Pertanyaan uji"
            placeholder="Nilai anak saya kok tidak muncul?"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="submit" disabled={!question.trim() || test.isPending}>
              {test.isPending && <Spinner />}
              Uji
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
      {test.isPending ? (
        <Skeleton className="h-5 w-3/4" />
      ) : test.data?.status === "matched" ? (
        <p className="text-muted-foreground" role="status">
          → <span className="font-medium text-foreground">{test.data.elementName}</span>{" "}
          <CheckIcon aria-label="cocok" className="inline size-4 text-foreground" />{" "}
          {test.data.sentence
            ? `"${test.data.sentence}"`
            : `cocok dengan gejala "${test.data.symptom}"`}
        </p>
      ) : (
        test.data?.status === "no_match" && (
          <p className="text-muted-foreground" role="status">
            → Belum cocok dengan gejala mana pun. Tambahkan gejalanya di atas bila pertanyaan ini
            sering muncul.
          </p>
        )
      )}
    </div>
  );
}
