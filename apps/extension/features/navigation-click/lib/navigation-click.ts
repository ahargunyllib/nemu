export type Point = { x: number; y: number };

/** The step of a navigation click the cursor is showing. */
export type ClickStep = "morph" | "move" | "click" | "check";

/**
 * What the mascot shows during and after a navigation click, in the mascot's state names (#6):
 * `clicking` while it acts as a cursor, then `success` or `warning`.
 */
export type CursorFrame =
  | { mascot: "clicking"; step: ClickStep; at: Point; moveMs: number }
  | { mascot: "success" | "warning"; at: Point };

/**
 * How a navigation click ended: `succeeded` when the page changed, `missing` when the target
 * wasn't on the page, `no-change` when the click changed nothing, `stopped` when Esc came first.
 */
export type ClickOutcome = "succeeded" | "missing" | "no-change" | "stopped";

export const MORPH_MS = 200;
export const MIN_MOVE_MS = 400;
export const MAX_MOVE_MS = 800;
/** How long the page has to show the click's result: a new URL or a new element. */
export const CHECK_TIMEOUT_MS = 2_000;
const CHECK_INTERVAL_MS = 50;

/** Longer trips take longer, within 400–800 ms. */
export function moveDuration(from: Point, to: Point): number {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.round(Math.min(MAX_MOVE_MS, MIN_MOVE_MS + distance / 2));
}

type NavigationClick = {
  target: string;
  /** Where the mascot starts, usually where Rina opened the Composer. */
  from: Point;
  /** Aborting before the click (Esc) cancels it; the click itself can't be undone. */
  signal: AbortSignal;
  onFrame: (frame: CursorFrame) => void;
  reducedMotion?: boolean;
  root?: Document;
};

/**
 * Clicks a target the way a person would be shown it: the mascot morphs into a cursor, moves to
 * the target, clicks, then waits for the page to change. Callers enforce Action Levels first;
 * this only runs the click.
 */
export async function runNavigationClick({
  target,
  from,
  signal,
  onFrame,
  reducedMotion = false,
  root = document,
}: NavigationClick): Promise<ClickOutcome> {
  const element = findTarget(root, target);
  if (!element) {
    onFrame({ mascot: "warning", at: from });
    return "missing";
  }

  element.scrollIntoView({ block: "nearest", behavior: "instant" });
  const to = centerOf(element);

  onFrame({ mascot: "clicking", step: "morph", at: from, moveMs: 0 });
  if (!(await pause(reducedMotion ? 0 : MORPH_MS, signal))) return "stopped";

  const moveMs = reducedMotion ? 0 : moveDuration(from, to);
  onFrame({ mascot: "clicking", step: "move", at: to, moveMs });
  if (!(await pause(moveMs, signal))) return "stopped";

  if (!element.isConnected) {
    onFrame({ mascot: "warning", at: to });
    return "missing";
  }

  const before = snapshot(root);
  onFrame({ mascot: "clicking", step: "click", at: to, moveMs: 0 });
  element.click();

  onFrame({ mascot: "clicking", step: "check", at: to, moveMs: 0 });
  const changed = await waitForChange(root, before);
  onFrame({ mascot: changed ? "success" : "warning", at: to });
  return changed ? "succeeded" : "no-change";
}

function findTarget(root: Document, target: string): HTMLElement | null {
  // The contract limits a nemu_id to [a-zA-Z0-9:_-], so it is safe inside a quoted selector.
  return root.querySelector<HTMLElement>(`[data-nemu-id="${target}"]`);
}

function centerOf(element: HTMLElement): Point {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/** Resolves `false` as soon as the signal aborts, `true` once the time has passed. */
function pause(ms: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      resolve(true);
    }, ms);
    function stop() {
      clearTimeout(timer);
      resolve(false);
    }
    signal.addEventListener("abort", stop, { once: true });
  });
}

type PageSnapshot = { url: string; nemuIds: Set<string> };

function snapshot(root: Document): PageSnapshot {
  return { url: root.location.href, nemuIds: nemuIdsOn(root) };
}

function nemuIdsOn(root: Document): Set<string> {
  return new Set(
    Array.from(root.querySelectorAll<HTMLElement>("[data-nemu-id]"), (element) => {
      return element.dataset.nemuId ?? "";
    }),
  );
}

/** The click worked when the URL changed or an element with a new nemu_id appeared. */
async function waitForChange(root: Document, before: PageSnapshot): Promise<boolean> {
  for (let waited = 0; waited <= CHECK_TIMEOUT_MS; waited += CHECK_INTERVAL_MS) {
    if (root.location.href !== before.url) return true;
    for (const nemuId of nemuIdsOn(root)) if (!before.nemuIds.has(nemuId)) return true;
    await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL_MS));
  }
  return false;
}
