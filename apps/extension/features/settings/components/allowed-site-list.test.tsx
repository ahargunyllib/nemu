// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { AllowedSiteList } from "./allowed-site-list";

afterEach(cleanup);

const SITES = [
  { pattern: "*.alursekolah.id", label: "AlurSekolah" },
  { pattern: "portal.sekolah.sch.id", label: "Portal sekolah" },
];

describe("AllowedSiteList", () => {
  test("asks for a site added after install and shows the rest as active", () => {
    const onGrant = vi.fn();
    render(
      <AllowedSiteList sites={SITES} granted={new Set(["*.alursekolah.id"])} onGrant={onGrant} />,
    );

    expect(screen.getAllByText("Aktif")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Izinkan" }));
    expect(onGrant).toHaveBeenCalledWith(SITES[1]);
  });
});
