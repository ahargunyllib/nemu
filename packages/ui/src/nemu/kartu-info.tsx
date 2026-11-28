import { Button } from "@nemu/ui/components/button";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import type { KartuInfoProps } from "@nemu/ui/lib/nemu-display";
import {
  NEMU_BUTTON,
  NEMU_DETAIL,
  NEMU_LINK,
  NemuActionRow,
  NemuCard,
} from "@nemu/ui/nemu/nemu-frame";
import { useId } from "react";

/**
 * Kartu Info: something to read. A title with an optional detail line, a short numbered list
 * (small amber circles 1, 2, 3, under an optional label), then one row: at most one link on the
 * left and a compact black [Tutup] on the right. No ×.
 */
export function KartuInfo({
  status,
  title,
  detail,
  items,
  itemsLabel,
  link,
  onClose,
}: KartuInfoProps) {
  const labelId = useId();
  return (
    <NemuCard display="info" label={title} status={status}>
      <CardHeader className="gap-1.5">
        <CardTitle className="text-xl leading-7 font-semibold">{title}</CardTitle>
        {detail && (
          <CardDescription data-nemu-detail className={NEMU_DETAIL}>
            {detail}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        {itemsLabel && (
          <p id={labelId} className="text-base leading-5 font-semibold text-nemu-secondary">
            {itemsLabel}
          </p>
        )}
        <ol aria-labelledby={itemsLabel ? labelId : undefined} className="flex flex-col">
          {items.map((item, index) => (
            <li key={item} className="flex items-start gap-3 py-1 text-xl leading-7">
              <span
                aria-hidden
                data-nemu-step
                className="flex size-[30px] shrink-0 items-center justify-center rounded-full border border-nemu-amber-200 bg-nemu-subtle text-[15px] leading-5 font-bold text-nemu-strong"
              >
                {index + 1}
              </span>
              <span className="pt-px">{item}</span>
            </li>
          ))}
        </ol>
      </CardContent>
      <CardFooter>
        <NemuActionRow
          links={
            link && (
              <Button type="button" variant="link" onClick={link.onSelect} className={NEMU_LINK}>
                {link.label}
              </Button>
            )
          }
        >
          <Button type="button" onClick={onClose} className={NEMU_BUTTON}>
            Tutup
          </Button>
        </NemuActionRow>
      </CardFooter>
    </NemuCard>
  );
}
