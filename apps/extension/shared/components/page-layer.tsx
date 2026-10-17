/**
 * A click-through layer over the whole viewport, just under the Composer and Answer Card panel,
 * where Nemu draws on the page: highlights now, the mascot (#6) next to them.
 */
export function PageLayer({ children }: { children: React.ReactNode }) {
  return <div className="pointer-events-none fixed inset-0 z-2147483646">{children}</div>;
}
