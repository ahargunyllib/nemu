import type { CommandRoute, GroundedAnswer, HelpExplanation } from "@nemu/contracts/school";
import { describe, expect, test, vi } from "vite-plus/test";

import { fromExplanation, PASSWORD_ON_SCREEN } from "../../ini-kenapa/lib/explanation";
import { fromGroundedAnswer, NOT_AVAILABLE_YET } from "../lib/answer";
import { answerQuestion } from "./answer-question";

const SNAPSHOT = {
  title: "AlurSekolah",
  url: "https://nemu-alursekolah.ahargunyllib.dev/#/nilai",
  alerts: ["Anda belum ditugaskan mengampu IPAS di kelas 4A. Hubungi admin sekolah."],
  headings: ["Isi nilai kelas"],
  fields: [{ label: "Kelas", value: "4A" }],
  screenshotBase64: null,
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
      entryId: "K-07",
      sentence: "Bukan kesalahan Ibu. Yang bisa memperbaiki: Pak Rizal (operator).",
      why: "Mata pelajaran itu belum ditugaskan ke akun Ibu.",
      teacherFault: false,
      canSelfFix: false,
      fixer: { name: "Pak Rizal", role: "operator", phone: "6281200001003" },
      guidedTarget: null,
      citation: {
        ...CITATION,
        docId: "kamus-kendala-sdit-nusantara",
        title: "Kamus Kendala",
        page: 2,
        article: "K-07",
      },
      waDraft: { phone: "6281200001003", text: "Assalamualaikum Pak Rizal. Mohon bantuannya." },
    })),
  };
}

const NO_ALERT = { ...SNAPSHOT, alerts: [] };

const NOT_IN_KAMUS: HelpExplanation = {
  status: "not_in_guide",
  sentence: "Belum ada di panduan sekolah. Mau saya bantu tanyakan ke Pak Rizal?",
  offerOperator: { name: "Pak Rizal", role: "operator", phone: "6281200001003" },
  waDraft: {
    phone: "6281200001003",
    text: "Assalamualaikum Pak Rizal. Nemu tidak bisa mendengar saya, mohon bantuannya.",
  },
};

function kenapaClient(explanation: HelpExplanation, answer: GroundedAnswer) {
  return {
    helpRoute: vi.fn(async (): Promise<CommandRoute> => ({
      kind: "intent",
      intent: "kenapa",
      processName: null,
    })),
    helpAsk: vi.fn(async () => answer),
    helpExplain: vi.fn(async () => explanation),
  };
}

describe("answerQuestion", () => {
  test("a question about school rules is answered from helpAsk, each source once", async () => {
    const client = fakeClient({ kind: "intent", intent: "tanya", processName: null });
    await expect(answerQuestion(client, "KKM berapa?", SNAPSHOT)).resolves.toEqual({
      kind: "answer",
      text: "KKM seluruh mata pelajaran adalah 75.",
      sources: ["SOP Penilaian SDIT Nusantara · hlm. 2 · 3.2"],
      // Sumber opens the cited PDF at its page (#258).
      files: [
        {
          label: "SOP Penilaian SDIT Nusantara · hlm. 2 · 3.2",
          docId: "sop-penilaian-sdit-nusantara",
          page: 2,
        },
      ],
    });
    expect(client.helpRoute).toHaveBeenCalledWith({ utterance: "KKM berapa?" });
    expect(client.helpExplain).not.toHaveBeenCalled();
  });

  test("'kenapa' sends what the page shows and the viewport screenshot to helpExplain", async () => {
    const client = fakeClient({ kind: "intent", intent: "kenapa", processName: null });
    await expect(
      answerQuestion(client, "Ini kenapa?", SNAPSHOT, async () => "JPEG"),
    ).resolves.toEqual({
      kind: "answer",
      text: "Bukan kesalahan Ibu. Yang bisa memperbaiki: Pak Rizal (operator).",
      why: "Mata pelajaran itu belum ditugaskan ke akun Ibu.",
      sources: ["Kamus Kendala · hlm. 2 · K-07"],
      next: {
        kind: "whatsapp",
        label: "Buka WhatsApp ke Pak Rizal",
        url: "https://web.whatsapp.com/send?phone=6281200001003&text=Assalamualaikum%20Pak%20Rizal.%20Mohon%20bantuannya.",
      },
    });
    expect(client.helpExplain).toHaveBeenCalledWith({
      snapshot: { ...SNAPSHOT, screenshotBase64: "JPEG" },
      question: "Ini kenapa?",
    });
  });

  test("with a password field on screen, 'kenapa' captures and sends nothing", async () => {
    const client = fakeClient({ kind: "intent", intent: "kenapa", processName: null });
    const capture = vi.fn(async () => "JPEG");
    await expect(answerQuestion(client, "Ini kenapa?", null, capture)).resolves.toEqual({
      kind: "notice",
      text: PASSWORD_ON_SCREEN,
    });
    expect(capture).not.toHaveBeenCalled();
    expect(client.helpExplain).not.toHaveBeenCalled();
  });

  test("grade entry goes to F1, a process to F3, and 'berhenti' closes the bubble", async () => {
    const grades = fakeClient({ kind: "intent", intent: "input_nilai", processName: null });
    await expect(answerQuestion(grades, "masukkan nilai UTS 4B", SNAPSHOT)).resolves.toEqual({
      kind: "grades",
      utterance: "masukkan nilai UTS 4B",
    });
    expect(grades.helpAsk).not.toHaveBeenCalled();

    const process = fakeClient({
      kind: "intent",
      intent: "proses",
      processName: "Catat Hafalan Tahfidz",
    });
    await expect(
      answerQuestion(process, "Catat setoran hafalan 4A hari ini", SNAPSHOT),
    ).resolves.toEqual({
      kind: "process",
      utterance: "Catat setoran hafalan 4A hari ini",
      processName: "Catat Hafalan Tahfidz",
    });
    expect(process.helpAsk).not.toHaveBeenCalled();

    const unnamed = fakeClient({ kind: "intent", intent: "proses", processName: null });
    await expect(answerQuestion(unnamed, "ajukan proses", SNAPSHOT)).resolves.toEqual({
      kind: "notice",
      text: NOT_AVAILABLE_YET,
    });

    const stop = fakeClient({ kind: "control", control: "berhenti" });
    await expect(answerQuestion(stop, "berhenti", SNAPSHOT)).resolves.toEqual({ kind: "stop" });
  });

  test("'cek kuis ini' is the extension's own quiz check (F4-01): nothing is sent", async () => {
    const client = fakeClient({ kind: "intent", intent: "unknown", processName: null });
    for (const words of [
      "Nemu, tolong cek kuis ini.",
      "Periksa kuis IPAS 4A ya",
      "check this quiz",
    ])
      await expect(answerQuestion(client, words, SNAPSHOT)).resolves.toEqual({
        kind: "quiz-check",
        utterance: words,
      });
    expect(client.helpRoute).not.toHaveBeenCalled();
    await expect(
      answerQuestion(client, "Kuis IPAS dibuka kapan?", SNAPSHOT),
    ).resolves.toMatchObject({
      kind: "answer",
    });
  });

  test("'hapus latihan …' is the extension's own quiz deletion warning (F4-06): nothing is sent", async () => {
    const client = fakeClient({ kind: "intent", intent: "unknown", processName: null });
    for (const words of [
      "Tolong hapus latihan bahasa Inggris yang kemarin.",
      "Nemu, hapus kuis ini",
      "ganti ulangan IPAS minggu lalu",
    ])
      await expect(answerQuestion(client, words, SNAPSHOT)).resolves.toEqual({
        kind: "quiz-delete",
        utterance: words,
      });
    expect(client.helpRoute).not.toHaveBeenCalled();
    await expect(
      answerQuestion(client, "Bagaimana cara menghapus nilai?", SNAPSHOT),
    ).resolves.toMatchObject({ kind: "answer" });
  });

  test("'masukkan kuis dari naskah ini' is the extension's own F4-03 flow (#210): nothing is sent", async () => {
    const client = fakeClient({ kind: "intent", intent: "unknown", processName: null });
    for (const words of [
      "Nemu, masukkan kuis dari naskah ini ke Moodle. Buka Senin 7 Desember, tutup Kamis 10 Desember.",
      "Buatkan kuis IPAS dari naskah ini",
      "naskah soal ini jadikan kuis di Moodle ya",
      "Pasang soal dari file ini ke Moodle kelas 4A, buka Senin sampai Kamis.",
    ])
      await expect(answerQuestion(client, words, SNAPSHOT)).resolves.toEqual({
        kind: "quiz-import",
        utterance: words,
      });
    expect(client.helpRoute).not.toHaveBeenCalled();
    // Grades for a quiz are F1's, and checking a quiz is F4-01's.
    const grades = fakeClient({ kind: "intent", intent: "input_nilai", processName: null });
    await expect(answerQuestion(grades, "masukkan nilai kuis IPAS 4A", SNAPSHOT)).resolves.toEqual({
      kind: "grades",
      utterance: "masukkan nilai kuis IPAS 4A",
    });
    await expect(answerQuestion(client, "Nemu, tolong cek kuis ini.", SNAPSHOT)).resolves.toEqual({
      kind: "quiz-check",
      utterance: "Nemu, tolong cek kuis ini.",
    });
  });

  test("'kenapa' the kamus doesn't know is answered from the school's documents (#314)", async () => {
    const answered: GroundedAnswer = {
      status: "answered",
      answer:
        "Nemu mendengar setelah Ibu menekan tombol mikrofon dan mengizinkan mikrofon di Chrome.",
      citations: [
        {
          chunkId: "tentang-nemu-4-1",
          docId: "tentang-nemu",
          title: "Tentang Nemu",
          page: null,
          article: "4.1",
          quote: "Tekan tombol mikrofon, lalu izinkan Chrome memakai mikrofon.",
        },
      ],
    };
    const client = kenapaClient(NOT_IN_KAMUS, answered);
    await expect(
      answerQuestion(client, "Kenapa Nemu tidak bisa mendengar saya?", NO_ALERT),
    ).resolves.toEqual(fromGroundedAnswer(answered));
  });

  test("a bare 'ini kenapa?' or an error on the page stays with the kamus (#314)", async () => {
    for (const [question, snapshot] of [
      ["Nemu, ini kenapa ya?", NO_ALERT],
      ["Kenapa Nemu tidak bisa mendengar saya?", SNAPSHOT],
    ] as const) {
      const client = kenapaClient(NOT_IN_KAMUS, {
        status: "answered",
        answer: "Jawaban dari panduan.",
        citations: [],
      });
      await expect(answerQuestion(client, question, snapshot)).resolves.toEqual(
        fromExplanation(NOT_IN_KAMUS),
      );
      expect(client.helpAsk).not.toHaveBeenCalled();
    }
  });

  test("'kenapa' neither the kamus nor the documents know keeps the offer to ask the operator", async () => {
    const client = kenapaClient(NOT_IN_KAMUS, {
      status: "not_in_guide",
      answer: "Belum ada di panduan sekolah.",
    });
    await expect(
      answerQuestion(client, "Kenapa Nemu tidak bisa mendengar saya?", NO_ALERT),
    ).resolves.toEqual(fromExplanation(NOT_IN_KAMUS));
  });
});
