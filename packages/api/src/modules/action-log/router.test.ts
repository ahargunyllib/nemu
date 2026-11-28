import { actionLog } from "@nemu/db/schema/action-log";
import { call, ORPCError } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import type { ExtensionCredentials } from "../../context";
import { createSchoolContext } from "../../testing/school";
import { createRegistrySchoolDirectory } from "../school/registry-directory";
import { createSchoolRepository } from "../school/repository";
import { actionLogRouter } from "./router";

const INSTALL_CODE = "NEMU-SDITN-2026";
const BU_SITI = "siti.aminah@sditnusantara.sch.id";
const PAK_RIZAL = "rizal.operator@sditnusantara.sch.id";

async function fromExtension(extension: ExtensionCredentials) {
  const context = await createSchoolContext();
  const directory = createRegistrySchoolDirectory(createSchoolRepository(context.db));
  return { ...context, session: null, extension, school: { ...context.school, directory } };
}

const FILLED = {
  website: "nemu-alursekolah.ahargunyllib.dev",
  task: "Isi nilai UTS Matematika 4B",
  action: "setValue",
  target: "Nilai Budi Santoso",
  cara: 1,
  result: "done",
  at: Date.UTC(2026, 11, 1, 2, 30),
} as const;

describe("action log (WS-10)", () => {
  it("records each executor action as the teacher on the page, with who, when and where", async () => {
    const context = await fromExtension({ installCode: INSTALL_CODE, email: BU_SITI });
    await expect(
      call(
        actionLogRouter.actionLogRecord,
        {
          entries: [
            FILLED,
            { ...FILLED, action: "point", target: "Simpan", result: "teacher", at: FILLED.at + 1 },
          ],
        },
        { context },
      ),
    ).resolves.toEqual({ recorded: 2 });

    const rows = await context.db.select().from(actionLog).orderBy(actionLog.actedAt);
    expect(rows).toMatchObject([
      {
        workspaceId: "W-SEKOLAH",
        teacherId: "siti",
        teacherName: "Siti Aminah, S.Pd.",
        website: "nemu-alursekolah.ahargunyllib.dev",
        action: "setValue",
        target: "Nilai Budi Santoso",
        cara: 1,
        result: "done",
      },
      { action: "point", target: "Simpan", result: "teacher" },
    ]);
    expect(rows[0]?.actedAt.getTime()).toBe(FILLED.at);
  });

  it("refuses an entry that carries a value, so no grade can reach the log", async () => {
    const context = await fromExtension({ installCode: INSTALL_CODE, email: BU_SITI });
    const error = await call(
      actionLogRouter.actionLogRecord,
      // As a client outside the contract could send it.
      JSON.parse(JSON.stringify({ entries: [{ ...FILLED, value: "77" }] })),
      { context },
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ORPCError);
    expect(error).toMatchObject({ code: "BAD_REQUEST" });
    expect(await context.db.select().from(actionLog)).toEqual([]);
  });

  it("refuses an account that isn't a registered teacher", async () => {
    const context = await fromExtension({ installCode: INSTALL_CODE, email: PAK_RIZAL });
    const error = await call(
      actionLogRouter.actionLogRecord,
      { entries: [FILLED] },
      { context },
    ).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("WS-10 action log page", () => {
  const ADMIN_JAVAN = { id: "javan", role: "admin", workspaceId: "W-SEKOLAH" };
  const OPERATOR = { id: "rizal", role: "operator", workspaceId: "W-SEKOLAH" };
  const TEACHER = { id: "siti", role: "guru", workspaceId: "W-SEKOLAH" };

  it("shows Admin Javan and the school operator what the executor recorded, newest first", async () => {
    const extension = await fromExtension({ installCode: INSTALL_CODE, email: BU_SITI });
    await call(
      actionLogRouter.actionLogRecord,
      {
        entries: [
          FILLED,
          { ...FILLED, action: "point", target: "Simpan", result: "teacher", at: FILLED.at + 1 },
        ],
      },
      { context: extension },
    );

    // The same database, with an Admin Workspace session instead of the extension's headers.
    const signedIn = async (user: typeof ADMIN_JAVAN) => ({
      ...extension,
      extension: null,
      session: (await createSchoolContext(user)).session,
    });
    const rows = await call(actionLogRouter.listActionLog, undefined, {
      context: await signedIn(ADMIN_JAVAN),
    });
    expect(rows).toMatchObject([
      { teacherName: "Siti Aminah, S.Pd.", action: "point", target: "Simpan", result: "teacher" },
      { action: "setValue", target: "Nilai Budi Santoso", cara: 1, result: "done" },
    ]);

    // ADR-0022: the operator reads the same log, and there is nothing on it to change.
    await expect(
      call(actionLogRouter.listActionLog, undefined, { context: await signedIn(OPERATOR) }),
    ).resolves.toEqual(rows);
    await expect(
      call(actionLogRouter.listActionLog, undefined, { context: await signedIn(TEACHER) }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
