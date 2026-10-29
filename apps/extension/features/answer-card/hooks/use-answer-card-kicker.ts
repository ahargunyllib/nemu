import { use } from "react";

import { type AnswerCardKicker, AnswerCardKickerContext } from "../contexts/answer-card-kicker";

export function useAnswerCardKicker(): AnswerCardKicker {
  return use(AnswerCardKickerContext);
}
