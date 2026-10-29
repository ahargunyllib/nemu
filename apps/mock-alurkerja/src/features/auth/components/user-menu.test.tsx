// @vitest-environment happy-dom
import { SidebarProvider } from "@nemu/ui/components/sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

const navigate = vi.fn(async () => undefined);

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/features/auth/api/auth-client", () => ({
  authClient: {
    useSession: () => ({
      isPending: false,
      data: { user: { name: "Rina Pratiwi", email: "rina@nemu.demo", role: "pegawai" } },
    }),
    signOut: ({ fetchOptions }: { fetchOptions: { onSuccess: () => Promise<void> } }) =>
      fetchOptions.onSuccess(),
  },
}));

import UserMenu from "./user-menu";

afterEach(cleanup);

describe("UserMenu", () => {
  test("signing out drops the account's cached data, such as its demo clock", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["getDemoClock"], { today: "2026-11-06" });
    render(
      <QueryClientProvider client={queryClient}>
        <SidebarProvider>
          <UserMenu />
        </SidebarProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Menu akun Rina Pratiwi" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Keluar" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/login" }));
    await waitFor(() => expect(queryClient.getQueryData(["getDemoClock"])).toBeUndefined());
  });
});
