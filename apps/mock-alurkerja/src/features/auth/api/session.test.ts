import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("./auth-client", () => ({ authClient: { getSession } }));

import { ensureSession, forgetSession } from "./session";

const rina = { user: { id: "rina", name: "Rina Pratiwi" } };

beforeEach(() => getSession.mockReset());

describe("ensureSession", () => {
  test("asks the Nemu Service once, so later navigations don't wait on it", async () => {
    getSession.mockResolvedValue({ data: rina });
    const queryClient = new QueryClient();

    await expect(ensureSession(queryClient)).resolves.toEqual(rina);
    await expect(ensureSession(queryClient)).resolves.toEqual(rina);

    expect(getSession).toHaveBeenCalledTimes(1);
  });

  test("keeps a signed-out visitor as null", async () => {
    getSession.mockResolvedValue({ data: null });

    await expect(ensureSession(new QueryClient())).resolves.toBeNull();
  });

  test("asks again after sign-in or sign-out forgets the session", async () => {
    getSession.mockResolvedValueOnce({ data: null }).mockResolvedValueOnce({ data: rina });
    const queryClient = new QueryClient();

    await expect(ensureSession(queryClient)).resolves.toBeNull();
    forgetSession(queryClient);

    await expect(ensureSession(queryClient)).resolves.toEqual(rina);
    expect(getSession).toHaveBeenCalledTimes(2);
  });
});
