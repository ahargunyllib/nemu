import { createFileRoute, redirect } from "@tanstack/react-router";
import { SparklesIcon } from "lucide-react";
import { useState } from "react";

import { authClient } from "@/features/auth/api/auth-client";
import SignInForm from "@/features/auth/components/sign-in-form";
import SignUpForm from "@/features/auth/components/sign-up-form";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (session.data) {
      throw redirect({ to: "/dashboard" });
    }
  },
});

function RouteComponent() {
  const [showSignIn, setShowSignIn] = useState(true);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex items-center gap-2 font-semibold">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <SparklesIcon className="size-4" />
        </div>
        Nemu Admin Workspace
      </div>
      <div className="w-full max-w-sm">
        {showSignIn ? (
          <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
        ) : (
          <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
        )}
      </div>
    </div>
  );
}
