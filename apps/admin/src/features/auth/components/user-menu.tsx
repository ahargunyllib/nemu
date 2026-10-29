import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@nemu/ui/components/dropdown-menu";
import { AccountMenu, AccountMenuSkeleton } from "@nemu/ui/shell/account-menu";
import { useNavigate } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";

import { authClient } from "@/features/auth/api/auth-client";

/** The signed-in admin at the bottom of the side menu; it opens the account menu. */
export default function UserMenu() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  if (isPending || !session) return <AccountMenuSkeleton />;

  const { name, email } = session.user;

  return (
    <AccountMenu name={name} detail="Admin" aria-label={`Account menu for ${name}`}>
      <DropdownMenuGroup>
        <DropdownMenuLabel>{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
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
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </AccountMenu>
  );
}
