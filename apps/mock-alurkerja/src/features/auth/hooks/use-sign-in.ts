import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { authClient } from "@/features/auth/api/auth-client";
import { forgetSession } from "@/features/auth/api/session";

export function useSignIn() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return (email: string, password: string) =>
    authClient.signIn.email(
      { email, password },
      {
        onSuccess: () => {
          // The login page kept the signed-out session; the new account's comes next.
          forgetSession(queryClient);
          navigate({ to: "/" });
        },
        onError: (error) => {
          toast.error(error.error.message || error.error.statusText);
        },
      },
    );
}
