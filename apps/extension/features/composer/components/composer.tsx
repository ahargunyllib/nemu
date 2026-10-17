import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from "@nemu/ui/components/input-group";
import { ArrowUpIcon } from "lucide-react";
import { useState } from "react";

type ComposerProps = {
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
};

export function Composer({ onSubmit, onCancel }: ComposerProps) {
  const [text, setText] = useState("");
  const prompt = text.trim();

  function submit() {
    if (prompt) onSubmit(prompt);
  }

  return (
    <InputGroup className="bg-background shadow-lg">
      <InputGroupTextarea
        autoFocus
        aria-label="Pertanyaan untuk Nemu"
        placeholder="Tanya Nemu tentang Perjalanan Dinas…"
        maxLength={4_000}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          } else if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <InputGroupAddon align="block-end">
        <InputGroupText>Enter kirim · Shift+Enter baris baru · Esc batal</InputGroupText>
        <InputGroupButton
          aria-label="Kirim"
          className="ml-auto"
          disabled={!prompt}
          size="icon-xs"
          variant="default"
          onClick={submit}
        >
          <ArrowUpIcon />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
