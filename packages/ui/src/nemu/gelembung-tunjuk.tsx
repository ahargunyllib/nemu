import type { GelembungTunjukProps } from "@nemu/ui/lib/nemu-display";
import { NemuBubble, NemuNoteLinks, NemuSentence } from "@nemu/ui/nemu/nemu-frame";

/**
 * Gelembung Tunjuk: the teacher's turn. It sits beside the button or field the cursor points at
 * and says one sentence. No buttons; at most one link.
 */
export function GelembungTunjuk({
  sentence,
  highlightedWord,
  status,
  note,
  onRead,
}: GelembungTunjukProps) {
  return (
    <NemuBubble display="tunjuk" label="Petunjuk Nemu" status={status}>
      <NemuSentence sentence={sentence} highlightedWord={highlightedWord} />
      {note && <NemuNoteLinks notes={note} onRead={onRead} />}
    </NemuBubble>
  );
}
