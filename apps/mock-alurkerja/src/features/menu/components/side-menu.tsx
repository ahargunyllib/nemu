import { buttonVariants } from "@nemu/ui/components/button";
import { cn } from "@nemu/ui/lib/utils";
import { Link } from "@tanstack/react-router";

import { MENU_ITEMS, TELCO_MENU_ITEMS } from "@/features/menu/lib/menu-items";

export default function SideMenu({ workspaceId }: { workspaceId?: string | null }) {
  if (workspaceId === "W-TELKO") {
    return (
      <nav aria-label="Menu utama" className="flex flex-col gap-1 border-r p-2">
        {TELCO_MENU_ITEMS.map(({ href, label, icon: Icon, nemuId }) => (
          <a
            key={href}
            href={href}
            data-nemu-id={nemuId}
            className={cn(buttonVariants({ variant: "ghost" }), "justify-start")}
          >
            <Icon />
            {label}
          </a>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label="Menu utama" className="flex flex-col gap-1 border-r p-2">
      {MENU_ITEMS.map(({ to, label, icon: Icon, nemuId }) => (
        <Link
          key={to}
          to={to}
          data-nemu-id={nemuId}
          activeOptions={{ exact: to === "/" }}
          className={cn(buttonVariants({ variant: "ghost" }), "justify-start")}
          activeProps={{ className: "bg-muted" }}
        >
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  );
}
