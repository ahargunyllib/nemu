import { teacherQuestion } from "@nemu/db/schema/teacher-question";
import { call } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import { createSchoolContext } from "../../testing/school";
import { helpRouter } from "../help/router";
import { createTeacherQuestionRepository } from "./repository";
import { teacherQuestionsRouter } from "./router";
import { startOfSchoolWeek, teacherQuestionStats } from "./service";

const OPERATOR = { id: "rizal", role: "operator", workspaceId: "W-SEKOLAH" };
const ADMIN_JAVAN = { id: "javan", role: "admin", workspaceId: "W-SEKOLAH" };

const PAGE = {
  title: "AlurSekolah (tiruan)",
  url: "http://localhost:3003/#/nilai",
  headings: ["Isi nilai kelas"],
  fields: [],
  screenshotBase64: null,
};

describe("Pertanyaan guru (ADR-0022)", () => {
  it("counts each teacher question for the operator, unanswered ones apart, without keeping its words", async () => {
    const teacher = await createSchoolContext();
    const ask = (question: string) => call(helpRouter.helpAsk, { question }, { context: teacher });
    const explain = (alert: string) =>
      call(
        helpRouter.helpExplain,
        { snapshot: { ...PAGE, alerts: [alert] }, question: "Nemu, ini kenapa?" },
        { context: teacher },
      );

    await expect(ask("KKM nilai berapa?")).resolves.toMatchObject({ status: "answered" });
    await expect(ask("Cuti melahirkan berapa bulan?")).resolves.toMatchObject({
      status: "not_in_guide",
    });
    await expect(
      explain(
        "Tidak dapat menampilkan siswa\nAnda belum ditugaskan mengampu IPAS di kelas 4A. Hubungi admin sekolah.",
      ),
    ).resolves.toMatchObject({ status: "matched" });
    await expect(explain("Printer kantor kehabisan kertas.")).resolves.toMatchObject({
      status: "not_in_guide",
    });

    const rows = await teacher.db.select().from(teacherQuestion);
    expect(rows).toHaveLength(4);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ teacherId: "siti", kind: "tanya", answered: true }),
        expect.objectContaining({ teacherId: "siti", kind: "tanya", answered: false }),
        expect.objectContaining({ teacherId: "siti", kind: "kenapa", answered: true }),
        expect.objectContaining({ teacherId: "siti", kind: "kenapa", answered: false }),
      ]),
    );
    expect(JSON.stringify(rows)).not.toMatch(/KKM|Cuti|Printer|IPAS/);

    for (const user of [OPERATOR, ADMIN_JAVAN]) {
      const signedIn = { ...teacher, session: (await createSchoolContext(user)).session };
      await expect(
        call(teacherQuestionsRouter.teacherQuestionStats, undefined, { context: signedIn }),
      ).resolves.toEqual({ askedThisWeek: 4, unansweredThisWeek: 2 });
    }
  });

  it("keeps the counts from a teacher", async () => {
    const teacher = await createSchoolContext();
    await expect(
      call(teacherQuestionsRouter.teacherQuestionStats, undefined, { context: teacher }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("counts from Monday 00.00 WIB, and only the school's own questions", async () => {
    const context = await createSchoolContext();
    const questions = createTeacherQuestionRepository(context.db);
    // Monday 7 December 2026, 00.00 WIB is Sunday 6 December, 17.00 UTC.
    const monday = new Date(Date.UTC(2026, 11, 6, 17));
    const asked = (askedAt: Date, answered: boolean, workspaceId = "W-SEKOLAH") =>
      questions.record({ workspaceId, teacherId: "siti", kind: "tanya", answered, askedAt });

    await asked(new Date(monday.getTime() - 1), false);
    await asked(monday, false);
    await asked(new Date(Date.UTC(2026, 11, 9, 3)), true);
    await asked(new Date(Date.UTC(2026, 11, 9, 3)), false, "W-TRAVEL");

    const thursday = new Date(Date.UTC(2026, 11, 10, 8));
    expect(startOfSchoolWeek(thursday)).toEqual(monday);
    expect(startOfSchoolWeek(monday)).toEqual(monday);
    expect(startOfSchoolWeek(new Date(monday.getTime() - 1))).toEqual(
      new Date(Date.UTC(2026, 10, 29, 17)),
    );
    await expect(teacherQuestionStats(questions, "W-SEKOLAH", thursday)).resolves.toEqual({
      askedThisWeek: 2,
      unansweredThisWeek: 1,
    });
  });
});
