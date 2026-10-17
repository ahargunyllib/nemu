import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { authClient } from "@/features/auth/api/auth-client";

export function useSignIn() {
  const navigate = useNavigate();

  return (email: string, password: string) =>
    authClient.signIn.email(
      { email, password },
      {
        onSuccess: () => {
          navigate({ to: "/" });
        },
        onError: (error) => {
          toast.error(error.error.message || error.error.statusText);
        },
      },
    );
}
