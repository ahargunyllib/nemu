import { NEMU_IDS } from "@nemu/contracts/nemu-ids";

/**
 * Jalan sendiri targets whose click opens a page where the answer goes on: after the click
 * succeeds, the extension asks the same question once more from that page, with its Element List.
 * Opening a Task is one (Momen 3: the uploads and Kirim exist only on the task page). The menu
 * click of Momen 1 isn't: its answer is complete, and asking again on the form would repeat it.
 */
const FOLLOW_UP_TARGETS: ReadonlySet<string> = new Set([NEMU_IDS.task.pertanggungjawaban]);

export function followsUpAfterClick(target: string): boolean {
  return FOLLOW_UP_TARGETS.has(target);
}
