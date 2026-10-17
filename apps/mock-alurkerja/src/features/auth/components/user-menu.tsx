import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Button } from "@nemu/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@nemu/ui/components/dropdown-menu";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { useNavigate } from "@tanstack/react-router";

import { authClient } from "@/features/auth/api/auth-client";

export default function UserMenu() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  if (isPending || !session) {
    return <Skeleton className="h-8 w-28" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-nemu-id={NEMU_IDS.shell.accountMenu}
        aria-label={`Menu akun ${session.user.name}`}
        render={<Button variant="outline" />}
      >
        {session.user.name}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card" align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{session.user.email}</DropdownMenuLabel>
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
  );
}
