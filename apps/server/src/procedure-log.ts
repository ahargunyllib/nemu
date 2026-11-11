import { ORPCError } from "@orpc/server";
import type { RequestLogger } from "evlog";

function tryCurrentLog(currentLog: () => RequestLogger): RequestLogger | undefined {
  try {
    return currentLog();
  } catch {
    return undefined;
  }
}

/** Names the procedure on the request's wide event, so Workers Logs can be filtered per feature. */
export function recordProcedureName(currentLog: () => RequestLogger, path: readonly string[]) {
  tryCurrentLog(currentLog)?.set({ operation: path.join(".") });
}

/**
 * oRPC turns a thrown error into a response before Hono sees it, so the request's
 * wide event would show a 500 without saying why. Record the error on it instead:
 * a client mistake (4xx) as a warning, anything else as an error with its stack.
 * Outside a request there is no wide event, so the error goes to the console.
 */
export function recordProcedureError(currentLog: () => RequestLogger, error: unknown) {
  const log = tryCurrentLog(currentLog);
  if (!log) {
    console.error(error);
    return;
  }

  if (error instanceof ORPCError && error.status < 500) {
    log.warn(error.message, { procedureError: { code: error.code, status: error.status } });
    return;
  }
  log.error(error instanceof Error ? error : new Error(String(error)));
}
