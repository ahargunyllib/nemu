import clicking from "../assets/clicking.svg?raw";
import guiding from "../assets/guiding.svg?raw";
import idle from "../assets/idle.svg?raw";
import listening from "../assets/listening.svg?raw";
import success from "../assets/success.svg?raw";
import thinking from "../assets/thinking.svg?raw";
import warning from "../assets/warning.svg?raw";
import type { MascotState } from "./mascot-state";

/**
 * One SVG per state, drawn inline: the firefly (docs/design-system.md, "Mascot"). The SVGs
 * share one shadow root, so each file prefixes its gradient ids with `nemu-mascot-<state>-`.
 */
export const MASCOT_ART: Record<MascotState, string> = {
  idle: fillBox(idle),
  listening: fillBox(listening),
  thinking: fillBox(thinking),
  guiding: fillBox(guiding),
  clicking: fillBox(clicking),
  success: fillBox(success),
  warning: fillBox(warning),
};

/** How each state moves. Every animation stops under prefers-reduced-motion. */
export const MASCOT_MOTION: Record<MascotState, string> = {
  idle: "",
  listening: "animate-pulse",
  thinking: "animate-bounce",
  guiding: "animate-pulse",
  clicking: "",
  success: "animate-in zoom-in-50 duration-300",
  warning: "animate-in zoom-in-50 duration-300",
};

/** Sizes the art to its box, whatever width and height the SVG file sets. */
function fillBox(svg: string): string {
  return svg.replace("<svg", '<svg class="size-full"');
}
