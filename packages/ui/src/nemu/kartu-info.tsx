import { Button } from "@nemu/ui/components/button";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import type { KartuInfoProps } from "@nemu/ui/lib/nemu-display";
import { BIG_BUTTON, NEMU_DETAIL, NEMU_LINK, NemuCard } from "@nemu/ui/nemu/nemu-frame";
import { cn } from "cn";

/**
 * Kartu Info: something to read. A title with an optional detail line, a short list, at most one
 * link, and one [Tutup].
 */
export function KartuInfo({ title, detail, items, link, onClose }: KartuInfoProps) {
  return (
    <NemuCard display="info" label={title}>
      <CardHeader className="gap-1.5">
        <CardTitle className="text-xl leading-7 font-semibold">{title}</CardTitle>
        {detail && (
          <CardDescription data-nemu-detail className={NEMU_DETAIL}>
            {detail}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <ul className="flex list-disc flex-col gap-2 pl-6 text-xl leading-7">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2">
        {link && (
          <Button
            type="button"
            variant="link"
            onClick={link.onSelect}
            className={cn(NEMU_LINK, "self-start")}
          >
            {link.label}
          </Button>
        )}
        <Button type="button" onClick={onClose} className={cn(BIG_BUTTON, "w-full")}>
          Tutup
        </Button>
      </CardFooter>
    </NemuCard>
  );
}
