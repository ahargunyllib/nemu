import { Button } from "@nemu/ui/components/button";

import { DEMO_ACCOUNTS } from "@/features/auth/lib/demo-accounts";
import { useSignIn } from "@/features/auth/hooks/use-sign-in";

export default function DemoAccountButtons() {
  const signIn = useSignIn();

  return (
    <div className="grid gap-2">
      {DEMO_ACCOUNTS.map((account) => (
        <Button
          key={account.nemuId}
          variant="outline"
          data-nemu-id={account.nemuId}
          onClick={() => signIn(account.email, account.password)}
        >
          {account.label}
        </Button>
      ))}
    </div>
  );
}
