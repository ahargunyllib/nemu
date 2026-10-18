import { createContext } from "react";

import type { MascotState } from "../../mascot/lib/mascot-state";

/** The state an Answer Card shows in its header's kicker row: "JAWABAN", "BERHASIL", "GAGAL". */
export type AnswerCardKicker = {
  label: string;
  tone: "nemu" | "success" | "danger";
  mascot: MascotState;
};

/**
 * Set by each card around the header it is given, so one header built by the overlay still shows
 * the state of whichever card renders it.
 */
export const AnswerCardKickerContext = createContext<AnswerCardKicker>({
  label: "Nemu",
  tone: "nemu",
  mascot: "idle",
});
