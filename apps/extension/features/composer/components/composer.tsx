import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from "@nemu/ui/components/input-group";
import { ArrowUpIcon, CropIcon } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";

import { usePointerDownOutside } from "../hooks/use-pointer-down-outside";

/** How long the Composer stays marked after a click outside it that didn't close it. */
const NUDGE_MS = 1_000;

type ComposerProps = {
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
  /** Starts area select mode; the Composer keeps its text while Rina drags a box. */
  onPickArea: () => void;
  /**
   * Everything Nemu draws, such as the Answer Card and the mascot. A click outside it lands on the
   * page: it closes an empty Composer, and marks one holding a draft instead of discarding it.
   */
  boundary: RefObject<HTMLElement | null>;
  /** What goes with the prompt, such as the Area Crop chip. */
  children?: React.ReactNode;
};

export function Composer({ onSubmit, onCancel, onPickArea, boundary, children }: ComposerProps) {
  const [text, setText] = useState("");
  const [nudged, setNudged] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const prompt = text.trim();
  const hasAttachment = Boolean(children);

  // The page stays usable while the Composer is open, so a click on it is no reason to lose a draft.
  usePointerDownOutside(boundary, () => {
    if (prompt || hasAttachment) setNudged(true);
    else onCancel();
  });

  useEffect(() => {
    if (!nudged) return;
    const timeout = setTimeout(() => setNudged(false), NUDGE_MS);
    return () => clearTimeout(timeout);
  }, [nudged]);

  // Back from area select mode with an attachment: Rina carries on typing.
  useEffect(() => {
    if (hasAttachment) textarea.current?.focus();
  }, [hasAttachment]);

  function submit() {
    if (prompt) onSubmit(prompt);
  }

  return (
    <InputGroup
      data-nudged={nudged || undefined}
      className="bg-background shadow-lg data-nudged:border-destructive data-nudged:ring-[3px] data-nudged:ring-destructive/20 dark:data-nudged:ring-destructive/40"
    >
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
