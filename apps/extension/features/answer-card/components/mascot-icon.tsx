import { MASCOT_ART } from "../../mascot/lib/mascot-art";
import type { MascotState } from "../../mascot/lib/mascot-state";

/** The mascot's art for a state, still and decorative, sized by `className`. */
export function MascotIcon({ state, className }: { state: MascotState; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
      // The art is bundled SVG from the mascot's assets/, never page or server content.
      dangerouslySetInnerHTML={{ __html: MASCOT_ART[state] }}
    />
  );
}
