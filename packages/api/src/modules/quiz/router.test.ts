import type { QuizJudgeInput } from "@nemu/contracts/quiz";
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
