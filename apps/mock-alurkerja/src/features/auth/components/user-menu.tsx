import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Avatar, AvatarFallback } from "@nemu/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@nemu/ui/components/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@nemu/ui/components/sidebar";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { useNavigate } from "@tanstack/react-router";

import { authClient } from "@/features/auth/api/auth-client";
import { JABATAN_LABELS } from "@/features/auth/lib/demo-accounts";

/** The signed-in user at the bottom of the side menu; it opens the account menu. */
export default function UserMenu() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  if (isPending || !session) {
    return (
      <div className="flex items-center gap-2 p-2">
        <Skeleton className="size-8 rounded-full" />
        <div className="grid flex-1 gap-1">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  const { name, email, role, golongan } = session.user;
  const jabatan = [JABATAN_LABELS[role ?? ""] ?? "Pegawai", golongan].filter(Boolean).join(" · ");

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            data-nemu-id={NEMU_IDS.shell.accountMenu}
            aria-label={`Menu akun ${name}`}
            render={<SidebarMenuButton size="lg" />}
          >
            <Avatar className="size-8">
              <AvatarFallback>{initials(name)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left leading-tight">
              <span className="truncate font-medium">{name}</span>
              <span className="truncate text-xs text-sidebar-foreground/70">{jabatan}</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56 bg-card" side="right" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                data-nemu-id={NEMU_IDS.shell.signOut}
                onClick={() => {
                  authClient.signOut({
                    fetchOptions: {
                      onSuccess: () => {
                        navigate({ to: "/login" });
                      },
                    },
                  });
                }}
              >
                Keluar
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
