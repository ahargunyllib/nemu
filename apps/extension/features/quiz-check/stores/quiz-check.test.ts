// @vitest-environment happy-dom
import type { NemuDisplay } from "@nemu/ui/lib/nemu-display";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { RunState, StepSource } from "../../executor/lib/run";
import type { QuizCheckRequest } from "../lib/requests";
import type { QuizContinuation } from "../lib/quiz-task";
import { attemptPage, PAGE_URLS, parse } from "../lib/test-pages";

let saved: unknown = null;
vi.mock("../api/request-quiz-check", () => ({
  requestQuizCheck: async (_pageEmail: unknown, request: QuizCheckRequest) => {
    if (request.op === "judge") return { ok: true, value: { problems: [] } };
    if (request.op === "state-save") saved = request.state;
    return { ok: true, value: request.op === "state-load" ? saved : null };
  },
}));

const sources = new Map<string, StepSource>();
const finishers = new Map<string, (ended: RunState, notes: string[], show: boolean) => void>();
const executor = {
  registerStepSource: (kind: string, source: StepSource) => sources.set(kind, source),
  registerFinisher: (
    kind: string,
    finisher: (ended: RunState, notes: string[], show: boolean) => void,
  ) => finishers.set(kind, finisher),
  start: vi.fn(async () => {}),
  presentNotes: vi.fn(),
};
vi.mock("../../executor/stores/executor", () => ({ executor }));

const { quizCheck } = await import("./quiz-check");
const { QUIZ_CHECK_KIND } = await import("../lib/quiz-task");

const spoken: string[] = [];

/** happy-dom's own way to change the page's address. */
function goTo(url: string) {
  (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(url);
}

async function settle() {
  for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

function view(): NemuDisplay {
  const display = quizCheck.getView().display;
  if (!display) throw new Error("Nemu shows nothing");
  return display;
}

function press(label: string) {
  const display = view();
  if (display.type !== "jawab" || display.action?.label !== label)
    throw new Error(`No “${label}” button: ${JSON.stringify(display)}`);
  display.action.onSelect();
}

/**
 * The preview of a quiz with `questions` questions on one page, read by the step source; the
 * questions in `noKey` have no key on Soal. Then the run ends with `status`.
 */
async function checked(questions: number, noKey: number[], status: RunState["status"] = "done") {
  goTo(PAGE_URLS.attempt);
  // One question per preview page, as on Moodle; the other pages are read through `fetch`.
  // Without the flag icons, which happy-dom would load from a Moodle that isn't running here.
  const preview = (current: number) =>
    attemptPage({ [current + 1]: {} }, questions, current).replaceAll(/<img[^>]*>/gu, "");
  vi.stubGlobal("fetch", async (url: string) => {
    const current = Number(new URL(url).searchParams.get("page") ?? 0);
    return new Response(`<!doctype html><html>${preview(current)}</html>`);
  });
  const page = parse(preview(0));
  document.body.innerHTML = page.body.innerHTML;
  document.body.id = page.body.id;
  document.body.className = page.body.className;
  const continuation: QuizContinuation = {
    phase: "preview",
    cmid: 3,
    utterance: "Nemu, tolong cek kuis ini.",
    honorific: "Bu",
    facts: {
      name: "Kuis IPAS 4A: Energi, Gaya, dan Peta",
      course: "4A-UJI · Kelas 4A (uji)",
      section: "IPAS",
      opens: null,
      closes: null,
      maxGrade: 100,
      listed: Array.from({ length: questions }, (_, index) => ({
        slot: index + 1,
        name: `Soal ${index + 1}`,
        questionId: index + 1,
        hasKey: !noKey.includes(index + 1),
      })),
    },
  };
  await sources.get(QUIZ_CHECK_KIND)?.(continuation);
  const ended = { status, continuation: null } as unknown as RunState;
  finishers.get(QUIZ_CHECK_KIND)?.(ended, ["Nemu membuka Setelan."], true);
  await settle();
}

beforeEach(() => {
  saved = null;
  spoken.length = 0;
  executor.presentNotes.mockClear();
  quizCheck.connect({
    pageEmail: { kind: "unreadable" },
    honorific: "Bu",
    speak: (text) => spoken.push(text),
  });
});

describe("F4-1's closing sentence (#256)", () => {
  test("after the last of two problems Nemu says one closing sentence, then Catatan langkah", async () => {
    await checked(3, [1, 3]);
    expect(view()).toMatchObject({
      sentence: "Soal 1 belum ada kunci jawabannya, Bu.",
      detail: "Ibu isi kuncinya lewat Edit soal. Nemu tidak mengubahnya.",
      status: { text: "Memeriksa kuis", count: "1 dari 2" },
      notes: {
        kenapa:
          "Semua pilihan di Soal 1 bernilai 0, jadi siswa yang menjawab benar pun mendapat 0.",
      },
    });
    // Only the sentence is spoken, not the detail line under it.
    expect(spoken.at(-1)).toBe("Soal 1 belum ada kunci jawabannya, Bu.");
    press("Lanjut");
    expect(view()).toMatchObject({
      sentence: "Soal 3 belum ada kunci jawabannya, Bu.",
      status: { text: "Memeriksa kuis", count: "2 dari 2" },
    });
    press("Lanjut");

    expect(view()).toMatchObject({
      type: "jawab",
      sentence: "Selain dua hal itu, kuisnya sudah siap, Bu.",
    });
    expect(quizCheck.getView().target).toBeNull();
    expect(spoken.at(-1)).toBe("Selain dua hal itu, kuisnya sudah siap, Bu.");
    expect(executor.presentNotes).not.toHaveBeenCalled();

    press("Catatan langkah");
    expect(quizCheck.getView().display).toBeNull();
    expect(executor.presentNotes).toHaveBeenCalledWith([
      "Nemu membuka Setelan.",
      "Masalah: Soal 1 belum ada kunci jawabannya, Bu. Ibu isi kuncinya lewat Edit soal. Nemu tidak mengubahnya.",
      "Masalah: Soal 3 belum ada kunci jawabannya, Bu. Ibu isi kuncinya lewat Edit soal. Nemu tidak mengubahnya.",
      "Nemu tidak mengubah apa pun di kuis ini.",
    ]);
  });

  test("with one problem the sentence says “hal itu”", async () => {
    await checked(2, [2]);
    press("Lanjut");
    expect(view()).toMatchObject({ sentence: "Selain hal itu, kuisnya sudah siap, Bu." });
  });

  test("a page load on the closing sentence shows it again (F0-13)", async () => {
    await checked(2, [2]);
    press("Lanjut");
    quizCheck.connect({ pageEmail: { kind: "unreadable" }, honorific: "", speak: () => {} });
    await quizCheck.restore();
    expect(view()).toMatchObject({ sentence: "Selain hal itu, kuisnya sudah siap, Bu." });
  });

  test("with no problems Nemu only says the quiz is ready", async () => {
    await checked(2, []);
    expect(view()).toMatchObject({
      sentence: "Kuis ini sudah siap. Nemu tidak menemukan masalah, Bu.",
    });
    press("Catatan langkah");
    expect(spoken.some((text) => text.startsWith("Selain"))).toBe(false);
  });

  test("a check that stopped early says nothing more", async () => {
    await checked(2, [2], "stopped");
    expect(quizCheck.getView().display).toBeNull();
    expect(spoken).toEqual([]);
  });

  test("a problem has Lanjut and no ×, also the last one", async () => {
    await checked(3, [1, 3]);
    press("Lanjut");
    const last = view();
    expect(last).toMatchObject({ status: { count: "2 dari 2" } });
    if (last.type !== "jawab") throw new Error("not a Gelembung Jawab");
    expect(last.onClose).toBeUndefined();
  });

  test("while it checks, Nemu says it looks as a student does, with only Berhenti", async () => {
    const shown: NemuDisplay[] = [];
    const stop = quizCheck.subscribe(() => {
      const display = quizCheck.getView().display;
      if (display) shown.push(display);
    });
    await checked(2, [2]);
    stop();
    const working = shown.find((display) => display.type === "kerja");
    expect(working).toMatchObject({
      sentence: "Saya lihat seperti siswa melihatnya.",
      detail: "Nemu tidak mengubah apa pun.",
      status: { text: "Memeriksa kuis" },
    });
    if (working?.type !== "kerja") throw new Error("no Gelembung Kerja");
    expect(working.onSlow).toBeUndefined();
  });

  test("Kenapa? is read aloud when she opens it", async () => {
    await checked(2, [2]);
    const display = view();
    if (display.type !== "jawab") throw new Error("not a Gelembung Jawab");
    display.onRead?.(display.notes?.kenapa ?? "");
    expect(spoken.at(-1)).toBe(
      "Semua pilihan di Soal 2 bernilai 0, jadi siswa yang menjawab benar pun mendapat 0.",
    );
  });
});
