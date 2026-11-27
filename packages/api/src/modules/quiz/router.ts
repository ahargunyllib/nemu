import { quizJudgeInputSchema, quizJudgementSchema } from "@nemu/contracts/quiz";

import { schoolProcedure } from "../../index";

export const quizRouter = {
  /**
   * F4-01: checks of a Moodle quiz that need judgement (#218). The extension finds the rule-based
   * problems itself and sends what it read; this adds only what a model would judge.
   */
  quizJudge: schoolProcedure
    .input(quizJudgeInputSchema)
    .output(quizJudgementSchema)
    .handler(({ context, input }) => context.school.ai.judgeQuiz(input)),
};
