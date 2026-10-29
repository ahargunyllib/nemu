import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@nemu/ui/components/dropdown-menu";
import { AccountMenu, AccountMenuSkeleton } from "@nemu/ui/shell/account-menu";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { authClient } from "@/features/auth/api/auth-client";
import { JABATAN_LABELS } from "@/features/auth/lib/demo-accounts";

/** The signed-in user at the bottom of the side menu; it opens the account menu. */
export default function UserMenu() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session, isPending } = authClient.useSession();

  if (isPending || !session) return <AccountMenuSkeleton />;

  const { name, email, role, golongan } = session.user;
  const jabatan = [JABATAN_LABELS[role ?? ""] ?? "Pegawai", golongan].filter(Boolean).join(" · ");

  return (
    <AccountMenu
      name={name}
      detail={jabatan}
      data-nemu-id={NEMU_IDS.shell.accountMenu}
      aria-label={`Menu akun ${name}`}
    >
      <DropdownMenuGroup>
        <DropdownMenuLabel>{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          data-nemu-id={NEMU_IDS.shell.signOut}
          onClick={() => {
            authClient.signOut({
              fetchOptions: {
                // Drop the signed-out account's data, such as its workspace's demo clock, so the
                // next account to sign in never sees it.
                onSuccess: async () => {
                  await navigate({ to: "/login" });
                  queryClient.clear();
                },
              },
            });
          }}
        >
          Keluar
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </AccountMenu>
  );
}
