import type { ReactNode } from "react";

export default function Header({ children }: { children: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
      <span className="text-sm font-medium">Satker Demo · Yogyakarta</span>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{children}</div>
    </header>
  );
}
