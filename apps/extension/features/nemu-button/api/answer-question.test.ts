import type { CommandRoute } from "@nemu/contracts/school";
import { describe, expect, test, vi } from "vite-plus/test";

import { NOT_AVAILABLE_YET } from "../lib/answer";
import { answerQuestion } from "./answer-question";

const SNAPSHOT = {
  title: "AlurSekolah",
  url: "https://nemu-alursekolah.ahargunyllib.dev/#/nilai",
  texts: ["Isi nilai kelas"],
  elements: [],
  screenshotBase64: null,
  blocked: false,
  blockedReason: null,
};

const CITATION = {
  chunkId: "sop-p2-3-2",
  docId: "sop-penilaian-sdit-nusantara",
  title: "SOP Penilaian SDIT Nusantara",
  page: 2,
  article: "3.2",
  quote: "KKM untuk seluruh mata pelajaran adalah 75.",
};

function fakeClient(route: CommandRoute) {
  return {
    helpRoute: vi.fn(async () => route),
    helpAsk: vi.fn(async () => ({
      status: "answered" as const,
      answer: "KKM seluruh mata pelajaran adalah 75.",
      citations: [CITATION, CITATION],
    })),
    helpExplain: vi.fn(async () => ({
      status: "matched" as const,
      entryId: "K-03",
      sentence: "Bukan kesalahan Ibu. Yang bisa memperbaiki: Pak Rizal (operator).",
      why: "Mata pelajaran belum dipetakan ke kelas.",
      teacherFault: false,
      canSelfFix: false,
      fixer: null,
      guidedTarget: null,
      citation: {
        ...CITATION,
        docId: "kamus-kendala-sdit-nusantara",
        title: "Kamus Kendala",
        page: 2,
        article: "K-03",
      },
      waDraft: null,
    })),
  };
}

describe("answerQuestion", () => {
  test("a question about school rules is answered from helpAsk, each source once", async () => {
    const client = fakeClient({ kind: "intent", intent: "tanya", processName: null });
    await expect(answerQuestion(client, "KKM berapa?", SNAPSHOT)).resolves.toEqual({
      kind: "answer",
      text: "KKM seluruh mata pelajaran adalah 75.",
      sources: ["SOP Penilaian SDIT Nusantara · hlm. 2 · 3.2"],
    });
    expect(client.helpRoute).toHaveBeenCalledWith({ utterance: "KKM berapa?" });
    expect(client.helpExplain).not.toHaveBeenCalled();
  });

  test("'kenapa' sends what the page shows to helpExplain", async () => {
    const client = fakeClient({ kind: "intent", intent: "kenapa", processName: null });
    await expect(answerQuestion(client, "Ini kenapa?", SNAPSHOT)).resolves.toEqual({
      kind: "answer",
      text: "Bukan kesalahan Ibu. Yang bisa memperbaiki: Pak Rizal (operator).",
      sources: ["Kamus Kendala · hlm. 2 · K-03"],
    });
    expect(client.helpExplain).toHaveBeenCalledWith({
      snapshot: SNAPSHOT,
      question: "Ini kenapa?",
    });
  });

  test("grade entry isn't run from the type box yet, and 'berhenti' closes the bubble", async () => {
    const grades = fakeClient({ kind: "intent", intent: "input_nilai", processName: null });
    await expect(answerQuestion(grades, "masukkan nilai UTS 4B", SNAPSHOT)).resolves.toEqual({
      kind: "notice",
      text: NOT_AVAILABLE_YET,
    });
    expect(grades.helpAsk).not.toHaveBeenCalled();

    const stop = fakeClient({ kind: "control", control: "berhenti" });
    await expect(answerQuestion(stop, "berhenti", SNAPSHOT)).resolves.toEqual({ kind: "stop" });
  });
});
