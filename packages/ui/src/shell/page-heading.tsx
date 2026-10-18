import type { ReactNode } from "react";

/**
 * A page's title: an optional uppercase kicker above it, a description under it, and the page's
 * actions on the right.
 */
export function PageHeading({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        {kicker && (
          <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {kicker}
          </div>
        )}
        <h1 className="font-heading text-2xl font-semibold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
