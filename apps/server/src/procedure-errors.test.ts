import { ORPCError } from "@orpc/server";
import { createRequestLogger, initLogger } from "evlog";
import { describe, expect, it, vi } from "vite-plus/test";

import { recordProcedureError } from "./procedure-errors";

initLogger({ silent: true });

function emitAfter(error: unknown) {
  const log = createRequestLogger({ method: "POST", path: "/rpc/nemuChat" });
  recordProcedureError(() => log, error);
  return log.emit({ status: 500 });
}

describe("recordProcedureError", () => {
  it("puts a server failure and its message on the request's wide event as an error", () => {
    const event = emitAfter(
      new Error("Provider request failed with HTTP 402: Insufficient credits"),
    );

    expect(event).toMatchObject({
      level: "error",
      error: { message: "Provider request failed with HTTP 402: Insufficient credits" },
    });
  });

  it("records a client mistake as a warning, not an error", () => {
    const event = emitAfter(new ORPCError("FORBIDDEN", { message: "Not your workspace" }));

    expect(event).toMatchObject({
      level: "warn",
      procedureError: { code: "FORBIDDEN", status: 403 },
    });
  });

  it("still prints the error when there is no request to attach it to", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("boom");

    recordProcedureError(() => {
      throw new Error("outside a request");
    }, error);

    expect(consoleError).toHaveBeenCalledWith(error);
    consoleError.mockRestore();
  });
});
