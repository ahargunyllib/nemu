import { ORPCError } from "@orpc/server";
import type { RequestLogger } from "evlog";

/**
 * oRPC turns a thrown error into a response before Hono sees it, so the request's
 * wide event would show a 500 without saying why. Record the error on it instead:
 * a client mistake (4xx) as a warning, anything else as an error with its stack.
 * Outside a request there is no wide event, so the error goes to the console.
 */
export function recordProcedureError(currentLog: () => RequestLogger, error: unknown) {
  let log: RequestLogger;
  try {
    log = currentLog();
  } catch {
    console.error(error);
    return;
  }

  if (error instanceof ORPCError && error.status < 500) {
    log.warn(error.message, { procedureError: { code: error.code, status: error.status } });
    return;
  }
  log.error(error instanceof Error ? error : new Error(String(error)));
}
