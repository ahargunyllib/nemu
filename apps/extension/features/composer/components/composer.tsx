import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from "@nemu/ui/components/input-group";
import { ArrowUpIcon, CropIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ComposerProps = {
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
  /** Starts area select mode; the Composer keeps its text while Rina drags a box. */
  onPickArea: () => void;
  /** What goes with the prompt, such as the Area Crop chip. */
  children?: React.ReactNode;
};

export function Composer({ onSubmit, onCancel, onPickArea, children }: ComposerProps) {
  const [text, setText] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const prompt = text.trim();
  const hasAttachment = Boolean(children);

  // Back from area select mode with an attachment: Rina carries on typing.
  useEffect(() => {
    if (hasAttachment) textarea.current?.focus();
  }, [hasAttachment]);

  function submit() {
    if (prompt) onSubmit(prompt);
  }

  return (
    <InputGroup className="bg-background shadow-lg">
      {children && <InputGroupAddon align="block-start">{children}</InputGroupAddon>}
      <InputGroupTextarea
        ref={textarea}
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
        <InputGroupButton aria-label="Pilih area" size="icon-xs" onClick={onPickArea}>
          <CropIcon />
        </InputGroupButton>
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
