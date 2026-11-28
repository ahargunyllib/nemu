import { Button } from "@nemu/ui/components/button";
import type { GelembungTunjukProps } from "@nemu/ui/lib/nemu-display";
import { NemuBadge } from "@nemu/ui/nemu/nemu-badge";
import {
  NEMU_LINK,
  NemuActionRow,
  NemuBubble,
  NemuNoteLinks,
  NemuText,
} from "@nemu/ui/nemu/nemu-frame";

/**
 * Gelembung Tunjuk: the teacher's turn. It sits beside the button or field the cursor points at
 * and says one sentence, with an optional detail line under it. No buttons: at most one link, an
 * optional amber chip ("Belum tersimpan") and an optional way out as a link at the bottom
 * ("Batal, jangan hapus").
 */
export function GelembungTunjuk({
  sentence,
  detail,
  highlightedWord,
  status,
  note,
  chip,
  cancel,
  onRead,
}: GelembungTunjukProps) {
  return (
    <NemuBubble display="tunjuk" label="Petunjuk Nemu" status={status}>
      <NemuText sentence={sentence} detail={detail} highlightedWord={highlightedWord} />
      {chip && (
        <NemuBadge
          tone="subtle"
          data-nemu-chip
          className="h-[34px] rounded-full border-nemu-amber-200 px-3.5 text-base leading-5 font-semibold"
        >
          {chip}
        </NemuBadge>
      )}
      {note && <NemuNoteLinks notes={note} onRead={onRead} />}
      {cancel && (
        <NemuActionRow
          links={
            <Button type="button" variant="link" onClick={cancel.onSelect} className={NEMU_LINK}>
              {cancel.label}
            </Button>
          }
        />
      )}
    </NemuBubble>
  );
}
