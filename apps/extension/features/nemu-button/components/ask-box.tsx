import { Input } from "@nemu/ui/components/input";
import { Spinner } from "@nemu/ui/components/spinner";
import { NemuButton } from "@nemu/ui/nemu/nemu-button";
import { ArrowRight } from "lucide-react";
import { type FormEvent, useState } from "react";

type AskBoxProps = {
  pending: boolean;
  onAsk: (question: string) => void;
};

/** The small type box the Nemu button opens: the Composer pill (docs/design-system.md). */
export function AskBox({ pending, onAsk }: AskBoxProps) {
  const [question, setQuestion] = useState("");
  const typed = question.trim().length > 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!typed || pending) return;
    onAsk(question.trim());
    setQuestion("");
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-[300px] items-center gap-1 rounded-2xl bg-nemu py-[5px] pr-[5px] pl-3.5 shadow-nemu-float"
    >
      <Input
        autoFocus
        value={question}
        maxLength={500}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="Tanya Nemu…"
        aria-label="Pertanyaan untuk Nemu"
        className="h-[30px] flex-1 border-0 bg-transparent px-0 text-sm text-nemu-foreground shadow-none placeholder:text-nemu-foreground/90 focus-visible:ring-0 dark:bg-transparent"
      />
      <NemuButton
        type="submit"
        size="icon-sm"
        tone={typed ? "inverse" : "soft"}
        disabled={!typed || pending}
        aria-label="Kirim"
        className="size-[30px] rounded-full"
      >
        {pending ? <Spinner /> : <ArrowRight />}
      </NemuButton>
    </form>
  );
}
