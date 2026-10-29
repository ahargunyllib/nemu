import type { NemuGuide } from "@nemu/contracts";
import { NEMU_IDS } from "@nemu/contracts/nemu-ids";

/**
 * Jalan sendiri targets whose click opens a page where the answer goes on: after the click
 * succeeds, the extension asks the same question from that page, with its Element List. A server
 * guide owns that continuation. The fixed Task target remains only for old responses without one.
 */
const FOLLOW_UP_TARGETS: ReadonlySet<string> = new Set([NEMU_IDS.task.pertanggungjawaban]);

export function followsUpAfterClick(target: string, guide?: NemuGuide): boolean {
  if (!guide) return FOLLOW_UP_TARGETS.has(target);
  return guide.steps.at(-1)?.target !== target;
}
