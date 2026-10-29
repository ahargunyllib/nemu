/**
 * A click-through layer over the whole viewport, just under the Composer and Answer Card panel
 * (over it while Nemu's cursor is out), where Nemu draws on the page: highlights, Nemu's cursor, and
 * the mascot.
 */
export function PageLayer({ children }: { children: React.ReactNode }) {
  return <div className="pointer-events-none fixed inset-0 z-2147483646">{children}</div>;
}
