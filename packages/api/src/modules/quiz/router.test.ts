import type { QuizJudgeInput } from "@nemu/contracts/quiz";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { call } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import { createSchoolContext } from "../../testing/school";
import { quizRouter } from "./router";

const F4_1: QuizJudgeInput = {
  utterance: "Nemu, tolong cek kuis ini.",
  quiz: {
    name: "Kuis IPAS 4A: Energi, Gaya, dan Peta",
    course: "4A-UJI",
    section: "IPAS",
    opens: "2026-12-02T07:00",
    closes: "2026-12-04T21:00",
    maxGrade: 100,
    listed: 1,
    questions: [
      {
        slot: 1,
        name: "Soal 01",
        text: "Sumber energi utama bagi Bumi adalah ....",
        hasKey: true,
        images: [],
      },
    ],
  },
  found: [],
};

describe("quizJudge (#218 seam)", () => {
  it("adds no judgement checks yet: the DOM rules in the extension cover F4-1", async () => {
    const context = await createSchoolContext();
    await expect(call(quizRouter.quizJudge, F4_1, { context })).resolves.toEqual({ problems: [] });
  });

  it("refuses a caller who isn't a teacher of the school", async () => {
    const context = await createSchoolContext();
    await expect(
      call(quizRouter.quizJudge, F4_1, { context: { ...context, session: null } }),
    ).rejects.toThrow();
  });
});

describe("quizScriptRead (F4-03, #219 seam)", () => {
  it("reads Richard's F4-2 script offline into 10 questions with nothing to ask", async () => {
    const pdf = await readFile(
      join(import.meta.dirname, "../../../../../infra/setup/f4-2/F4-2_naskah-ipas-10-soal.pdf"),
    );
    const context = await createSchoolContext();
    const result = await call(
      quizRouter.quizScriptRead,
      {
        file: {
          name: "F4-2_naskah-ipas-10-soal.pdf",
          mimeType: "application/pdf",
          dataUrl: `data:application/pdf;base64,${pdf.toString("base64")}`,
        },
        utterance: "Buka Senin 7 Desember, tutup Kamis 10 Desember.",
        today: "2026-12-01",
        course: "4A-UJI · Kelas 4A (uji)",
        sections: ["Umum", "IPAS", "Bahasa Inggris"],
      },
      { context },
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.questions).toEqual([]);
    expect(result.draft.questions).toHaveLength(10);
    expect(result.draft.section).toBe("IPAS");
    expect(result.draft.questions[6]!.choices.map((choice) => choice.image?.width)).toEqual([
      240, 240, 240,
    ]);
  });
});
