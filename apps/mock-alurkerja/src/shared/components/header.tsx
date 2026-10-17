import type { ReactNode } from "react";

export default function Header({ children }: { children: ReactNode }) {
  return (
    <header className="flex h-12 items-center justify-between border-b px-4">
      <span className="text-sm font-semibold">Alur Kerja Demo</span>
      <div className="flex items-center gap-2">{children}</div>
    </header>
  );
}
