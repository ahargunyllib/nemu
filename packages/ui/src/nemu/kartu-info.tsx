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

/**
 * Kartu Info: something to read. A title with an optional detail line, a short list, then one
 * row: at most one link on the left and a compact black [Tutup] on the right. No ×.
 */
export function KartuInfo({ status, title, detail, items, link, onClose }: KartuInfoProps) {
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
      <CardContent>
        <ul className="flex list-disc flex-col gap-2 pl-6 text-xl leading-7">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
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
