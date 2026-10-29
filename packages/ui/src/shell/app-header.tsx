import type { ReactNode } from "react";

/** The white top bar of `AppShell`: where you are on the left, who you are on the right. */
export function AppHeader({ start, end }: { start: ReactNode; end?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-background px-6">
      <div className="flex min-w-0 items-center gap-2 text-sm font-medium">{start}</div>
      {end && <div className="flex items-center gap-2 text-sm text-muted-foreground">{end}</div>}
    </header>
  );
}
