import { Button } from "@nemu/ui/components/button";
import { Kbd, KbdGroup } from "@nemu/ui/components/kbd";

import mascotSvg from "../assets/mascot-idle.svg?raw";

// Drawn inline so it needs no web-accessible file; the class makes it fill its circle.
const mascot = mascotSvg.replace("<svg", '<svg class="size-full"');

type NemuButtonProps = {
  open: boolean;
  onToggle: () => void;
};

/**
 * The Nemu button at the bottom right of every allowed page: the dark orange `nemu` disc with the
 * mascot. Clicking it opens the type box; the hint says how to talk instead (voice is #200).
 */
export function NemuButton({ open, onToggle }: NemuButtonProps) {
  return (
    <div className="flex items-center gap-2">
      {!open && (
        <p className="rounded-full bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-nemu-float">
          Tahan{" "}
          <KbdGroup>
            <Kbd>Ctrl</Kbd>+<Kbd>Spasi</Kbd>
          </KbdGroup>{" "}
          untuk bicara
        </p>
      )}
      <Button
        type="button"
        size="icon-lg"
        aria-label={open ? "Tutup Nemu" : "Tanya Nemu"}
        aria-expanded={open}
        onClick={onToggle}
        className="size-14 rounded-full bg-nemu p-1 text-nemu-foreground shadow-nemu-float hover:bg-nemu-amber-700"
      >
        <span
          aria-hidden
          className="flex size-12 rounded-full bg-nemu-foreground"
          dangerouslySetInnerHTML={{ __html: mascot }}
        />
      </Button>
    </div>
  );
}
