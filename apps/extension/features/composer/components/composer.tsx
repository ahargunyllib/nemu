import { Card } from "@nemu/ui/components/card";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@nemu/ui/components/input-group";
import { NemuButton } from "@nemu/ui/nemu/nemu-button";
import { ArrowRightIcon, CropIcon } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";

import { usePointerDownOutside } from "../hooks/use-pointer-down-outside";

/** How long the Composer stays marked after a click outside it that didn't close it. */
const NUDGE_MS = 1_000;

/** The pill's own width, so it doesn't follow the Answer Card panel's. */
export const COMPOSER_WIDTH = 300;

type ComposerProps = {
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
  /** Starts area select mode; the Composer keeps its text while Rina drags a box. */
  onPickArea: () => void;
  /** Area select mode is on: the crop button is the pressed one and the pill says how to drag. */
  picking?: boolean;
  /**
   * Everything Nemu draws, such as the Answer Card and the mascot. A click outside it lands on the
   * page: it closes an empty Composer, and marks one holding a draft instead of discarding it.
   */
  boundary: RefObject<HTMLElement | null>;
  /** What goes with the prompt, such as the Area Crop chip; the Composer becomes its Kartu area. */
  children?: React.ReactNode;
};

function placeholder(picking: boolean, hasAttachment: boolean) {
  if (picking) return "Seret area di layar · Esc batal";
  if (hasAttachment) return "Tanya tentang bagian ini…";
  return "Tanya Nemu…";
}

export function Composer({
  onSubmit,
  onCancel,
  onPickArea,
  picking = false,
  boundary,
  children,
}: ComposerProps) {
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

  // The Tanya Nemu pill (docs/design-system.md, "Composer"): 300px wide, one 40px line on the nemu
  // fill that grows to three as the text wraps. Each button turns white once it is the one to press.
  const pill = (
    <InputGroup
      data-nudged={nudged || undefined}
      style={{ width: COMPOSER_WIDTH }}
      className="min-h-10 items-end gap-1 rounded-2xl border-0 bg-nemu py-[5px] pr-[5px] pl-3.5 text-nemu-foreground shadow-nemu-float in-data-[slot=card]:w-full! in-data-[slot=card]:shadow-none has-[textarea]:rounded-2xl has-[[data-slot=input-group-control]:focus-visible]:ring-0 data-nudged:ring-[3px] data-nudged:ring-destructive/40"
    >
      <InputGroupTextarea
        ref={textarea}
        autoFocus
        rows={1}
        aria-label="Pertanyaan untuk Nemu"
        placeholder={placeholder(picking, hasAttachment)}
        maxLength={4_000}
        value={text}
        // Body/Small, 13/18: a 30px line beside the buttons, scrolling past three lines.
        className="max-h-[66px] min-h-0 px-0 py-1.5 text-[13px] leading-[18px] text-nemu-foreground caret-nemu-foreground placeholder:text-nemu-foreground/92 md:text-[13px]"
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
      <InputGroupAddon align="inline-end" className="gap-1 p-0 has-[>button]:mr-0">
        <NemuButton
          aria-label="Pilih area"
          aria-pressed={picking}
          size="icon-sm"
          className="size-7.5"
          tone={picking ? "inverse" : "soft"}
          onClick={onPickArea}
        >
          <CropIcon />
        </NemuButton>
        <NemuButton
          aria-label="Kirim"
          className="size-7.5 disabled:opacity-100"
          disabled={!prompt}
          size="icon-sm"
          tone={prompt ? "inverse" : "soft"}
          onClick={submit}
        >
          <ArrowRightIcon />
        </NemuButton>
      </InputGroupAddon>
    </InputGroup>
  );

  if (!hasAttachment) return pill;

  // Kartu area (docs/design-system.md, "Composer"): a 288 px white card holding the Area Crop above
  // the pill, which takes its full inner width.
  return (
    <Card
      size="sm"
      className="w-72 gap-2 rounded-[14px] border px-3 pt-2.5 pb-3 shadow-nemu-float ring-0"
    >
      {children}
      {pill}
    </Card>
  );
}
