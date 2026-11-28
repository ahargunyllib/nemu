import type { ReactNode } from "react";

/**
 * The white top bar of `AppShell`: `start` on the left (a search, or where you are), `end` on the
 * right (the app's own controls, then who you are).
 */
export function AppHeader({ start, end }: { start: ReactNode; end?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-background px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">{start}</div>
      {end && <div className="flex shrink-0 items-center gap-3 text-sm">{end}</div>}
    </header>
  );
}
