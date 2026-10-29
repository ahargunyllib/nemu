import { Badge } from "@nemu/ui/components/badge";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";

/** Nemu-branded fills layered on the stock shadcn Badge, which stays untouched. */
const nemuBadgeVariants = cva("", {
  variants: {
    tone: {
      /** Target labels and "Pilih ini": the nemu-amber 600 pill with white text. */
      solid: "bg-nemu text-nemu-foreground",
      /** Citations such as "PMK 119/2023": amber 50 with amber 800 text. */
      subtle: "bg-nemu-subtle text-nemu-subtle-foreground",
      /** "Kamu yang mengirim": the user, not Nemu, does the next step. */
      success: "bg-nemu-success text-nemu-success-foreground",
      /** "Tidak sesuai hitungan Rp447.000": a field no longer holds what Nemu filled. */
      danger: "bg-nemu-danger-subtle text-destructive",
    },
  },
  defaultVariants: {
    tone: "solid",
  },
});

type NemuBadgeProps = Omit<ComponentProps<typeof Badge>, "variant"> &
  VariantProps<typeof nemuBadgeVariants>;

export function NemuBadge({ tone, className, ...props }: NemuBadgeProps) {
  return <Badge className={cn(nemuBadgeVariants({ tone }), className)} {...props} />;
}
