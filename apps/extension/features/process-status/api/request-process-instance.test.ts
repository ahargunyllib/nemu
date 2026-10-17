import { describe, expect, test, vi } from "vite-plus/test";

import { type ProcessInstanceClient, requestProcessInstance } from "./request-process-instance";

const DEMO_APP_PAGE = "http://localhost:3001/perdin/task/PD-2026-0042";

function fakeClient(reply: () => Promise<unknown>) {
  const getProcessInstance = vi.fn(reply);
  const client: ProcessInstanceClient = { getProcessInstance };
  return { client, getProcessInstance };
}

describe("requestProcessInstance", () => {
  test("returns the State and active Task from get_process_instance", async () => {
    const { client } = fakeClient(async () => ({
      id: "PD-2026-0042",
      state: "Pertanggungjawaban",
      activeTask: { id: "PJ-PD-2026-0042", key: "pertanggungjawaban", label: "Pertanggungjawaban" },
      kotaTujuan: "Makassar",
    }));

    expect(await requestProcessInstance(client, "PD-2026-0042", DEMO_APP_PAGE)).toEqual({
      kind: "instance",
      instance: {
        id: "PD-2026-0042",
        state: "Pertanggungjawaban",
        activeTask: { id: "PJ-PD-2026-0042", label: "Pertanggungjawaban" },
      },
    });
  });

  test("reports a failed or off-contract reply as an error", async () => {
    const failing = fakeClient(async () => {
      throw new Error("NOT_FOUND");
    });
    const malformed = fakeClient(async () => ({ id: "PD-2026-0042", state: "Hilang" }));

    for (const { client } of [failing, malformed]) {
      expect(await requestProcessInstance(client, "PD-2026-0042", DEMO_APP_PAGE)).toEqual({
        kind: "error",
      });
    }
  });

  test("reads nothing for a page outside the allowlist", async () => {
    const { client, getProcessInstance } = fakeClient(async () => ({}));

    await requestProcessInstance(client, "PD-2026-0042", "https://example.com/");

    expect(getProcessInstance).not.toHaveBeenCalled();
  });
});
