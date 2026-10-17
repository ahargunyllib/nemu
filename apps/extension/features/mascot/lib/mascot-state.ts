/** What the mascot shows (#6), from resting to the result of what Nemu did on the page. */
export type MascotState =
  | "idle"
  | "listening"
  | "thinking"
  | "guiding"
  | "clicking"
  | "success"
  | "warning";

/** What Nemu is doing right now, as the overlay sees it. */
export type MascotActivity = {
  /** The Composer is open (and, with the Area Crop, while a box is being dragged). */
  listening: boolean;
  /** A prompt was sent with Kirim and its answer hasn't come back yet. */
  thinking: boolean;
  /** Nemu is clicking a Jalan sendiri target. */
  clicking: boolean;
  /** Highlights are on the page. */
  guiding: boolean;
  /** Nemu's click opened what it should: the page matches. */
  succeeded: boolean;
  /** The request failed, a target isn't on the page, or Nemu's click changed nothing. */
  failed: boolean;
};

/** Success and warning are results: they rest after a while instead of lasting. */
export function isResult(state: MascotState): boolean {
  return state === "success" || state === "warning";
}

/**
 * The mascot's state for what Nemu is doing. Once a result has `rested`, the mascot falls back
 * to what is still going on: guiding while highlights remain, otherwise idle.
 */
export function mascotStateFor(activity: MascotActivity, rested = false): MascotState {
  if (activity.listening) return "listening";
  if (activity.thinking) return "thinking";
  if (activity.clicking) return "clicking";
  if (!rested && activity.failed) return "warning";
  if (!rested && activity.succeeded) return "success";
  if (activity.guiding) return "guiding";
  return "idle";
}
