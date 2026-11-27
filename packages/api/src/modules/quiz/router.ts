import {
  quizJudgeInputSchema,
  quizJudgementSchema,
  quizScriptInputSchema,
  quizScriptResultSchema,
} from "@nemu/contracts/quiz";

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

  /**
   * F4-03 (#210, #219): the teacher's script read into a quiz draft and the questions Nemu has
   * for her; the extension turns the draft into Moodle XML once she has answered them.
   */
  quizScriptRead: schoolProcedure
    .input(quizScriptInputSchema)
    .output(quizScriptResultSchema)
    .handler(({ context, input }) => context.school.ai.readQuizScript(input)),
};
