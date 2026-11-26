import { cn } from "@nemu/ui/lib/utils";
import { Fragment } from "react";

import type { VoiceState } from "../hooks/use-voice";
import { mainSentence } from "../lib/word-timing";

type SpokenTextProps = {
  text: string;
  voice: VoiceState | null;
  onRepeat: () => void;
};

/**
 * A bubble's text with the word Nemu is speaking highlighted (F0-05). Clicking it speaks the main
 * sentence again.
 */
export function SpokenText({ text, voice, onRepeat }: SpokenTextProps) {
  const sentence = mainSentence(text);
  const rest = text.trim().slice(sentence.length);
  const spoken = voice?.sentence === sentence ? voice : null;
  const words = spoken?.words ?? sentence.split(/\s+/u);

  return (
    <button
      type="button"
      onClick={onRepeat}
      title="Klik untuk mendengar lagi"
      className="cursor-pointer text-left whitespace-pre-line"
    >
      {words.map((word, index) => (
        // Words repeat ("nilai … nilai"), so their place is their identity.
        <Fragment key={index}>
          {index > 0 && " "}
          <span
            aria-current={index === spoken?.activeIndex ? "true" : undefined}
            className={cn(
              "rounded-sm transition-colors",
              index === spoken?.activeIndex && "bg-nemu-amber-200 text-nemu-subtle-foreground",
            )}
          >
            {word}
          </span>
        </Fragment>
      ))}
      {rest}
    </button>
  );
}
