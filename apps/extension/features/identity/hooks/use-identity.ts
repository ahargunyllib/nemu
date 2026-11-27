import { useEffect, useState } from "react";

import type { PageEmail } from "../../../shared/lib/messages";
import { requestIdentity } from "../api/request-identity";
import type { IdentityResult } from "../lib/identity";

/** Who the page's account is at the school; null while it is being checked. */
export function useIdentity(pageEmail: PageEmail): IdentityResult | null {
  const [identity, setIdentity] = useState<IdentityResult | null>(null);
  const email = pageEmail.kind === "read" ? pageEmail.email : undefined;

  useEffect(() => {
    let current = true;
    setIdentity(null);
    void requestIdentity(
      email === undefined ? { kind: "unreadable" } : { kind: "read", email },
    ).then((result) => {
      if (current) setIdentity(result);
    });
    return () => {
      current = false;
    };
  }, [email]);

  return identity;
}
