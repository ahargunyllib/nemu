import type { QueryClient } from "@tanstack/react-query";

import { authClient } from "./auth-client";

const SESSION_QUERY_KEY = ["auth", "session"] as const;

/**
 * The signed-in session, or null. It is fetched once and kept until sign-in or sign-out
 * forgets it, so a navigation never waits on the Nemu Service: while a route's
 * `beforeLoad` waits, the URL has already changed but the old page is still on screen,
 * and the Nemu Extension would read that page as the new one.
 */
export function ensureSession(queryClient: QueryClient) {
  return queryClient.ensureQueryData({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => (await authClient.getSession()).data ?? null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
}

/** Drops the kept session, so the next navigation asks the Nemu Service again. */
export function forgetSession(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: SESSION_QUERY_KEY });
}
