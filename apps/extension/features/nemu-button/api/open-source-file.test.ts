import { ORPCError } from "@orpc/client";
import { describe, expect, test, vi } from "vite-plus/test";

import { openSourceFile } from "./open-source-file";

const SERVER = "http://localhost:3000";
const LINK = {
  path: "/api-reference/documents/sop-penilaian-sdit-nusantara/file?token=abc.def",
  expiresAt: 1,
};

describe("Sumber opens the cited PDF (#258)", () => {
  test("asks for a signed link and opens it at the cited page, next to the teacher's tab", async () => {
    const client = { documentFileLink: vi.fn(async () => LINK) };
    const openTab = vi.fn(async () => undefined);

    await expect(
      openSourceFile(
        { client, openTab, serverUrl: SERVER },
        { docId: "sop-penilaian-sdit-nusantara", page: 2 },
      ),
    ).resolves.toEqual({ opened: true });

    expect(client.documentFileLink).toHaveBeenCalledWith({ id: "sop-penilaian-sdit-nusantara" });
    expect(openTab).toHaveBeenCalledWith(
      "http://localhost:3000/api-reference/documents/sop-penilaian-sdit-nusantara/file?token=abc.def#page=2",
    );
  });

  test("opens the first page when the citation has none", async () => {
    const client = { documentFileLink: vi.fn(async () => LINK) };
    const openTab = vi.fn(async () => undefined);

    await openSourceFile({ client, openTab, serverUrl: SERVER }, { docId: "x", page: null });
    expect(openTab).toHaveBeenCalledWith(`${SERVER}${LINK.path}`);
  });

  test("says why and opens nothing when the Nemu Service refuses", async () => {
    const client = {
      documentFileLink: vi.fn(async () => {
        throw new ORPCError("NOT_FOUND", { message: "Dokumen tidak ditemukan" });
      }),
    };
    const openTab = vi.fn(async () => undefined);

    await expect(
      openSourceFile({ client, openTab, serverUrl: SERVER }, { docId: "x", page: 1 }),
    ).resolves.toEqual({ notice: "Dokumen tidak ditemukan" });
    expect(openTab).not.toHaveBeenCalled();
  });
});
