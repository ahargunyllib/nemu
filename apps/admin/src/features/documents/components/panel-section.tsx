import type { ReactNode } from "react";

/** A titled part of the knowledge panel: "Task dan halamannya · bisa dikoreksi" and the like. */
export default function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}
