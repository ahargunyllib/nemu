// @vitest-environment happy-dom
import type { ExecutorTask } from "@nemu/contracts/executor";
import type { QuizDraft, QuizScriptResult } from "@nemu/contracts/quiz";
import type { NemuDisplay } from "@nemu/ui/lib/nemu-display";
import { describe, expect, test, vi } from "vite-plus/test";

import type { StepSource } from "../../executor/lib/run";
import type { ImportContinuation } from "../lib/import-task";
import type { QuizImportRequest } from "../lib/requests";
import { coursePageHtml, quizEdit, URLS } from "../lib/test-pages";

const requests: QuizImportRequest[] = [];
let reading: QuizScriptResult;
vi.mock("../api/request-quiz-import", () => ({
  requestQuizImport: async (_pageEmail: unknown, request: QuizImportRequest) => {
    requests.push(request);
    return { ok: true, value: reading };
  },
}));

const sources = new Map<string, StepSource>();
const finishers = new Map<string, (...args: unknown[]) => void>();
const executor = {
  registerStepSource: (kind: string, source: StepSource) => sources.set(kind, source),
  registerFinisher: (kind: string, finisher: (...args: unknown[]) => void) =>
    finishers.set(kind, finisher),
  start: vi.fn(
    async (_task: ExecutorTask, _options: { cara?: number; continuation?: unknown }) => {},
  ),
  presentNotes: vi.fn(),
};
vi.mock("../../executor/stores/executor", () => ({ executor }));
const quizCheck = { start: vi.fn(async () => undefined) };
vi.mock("../../quiz-check/stores/quiz-check", () => ({ quizCheck }));

const { quizImport } = await import("./quiz-import");
const { QUIZ_IMPORT_KIND } = await import("../lib/import-task");

const choice = (text: string) => ({ text, image: null });
const DRAFT: QuizDraft = {
  name: "Latihan IPAS Kelas 4A",
  section: null,
  category: "$course$/top/IPAS 4A/Latihan IPAS Kelas 4A",
  opens: null,
  closes: null,
  questions: [
    {
      number: 1,
      text: "Tarikan atau dorongan pada suatu benda disebut ....",
      image: null,
      choices: ["energi", "gaya", "usaha", "massa"].map(choice),
      key: 1,
    },
    {
      number: 4,
      text: "Energi yang tersimpan di dalam makanan disebut energi ....",
      image: null,
      choices: ["listrik", "bunyi", "cahaya", "kimia"].map(choice),
      key: null,
    },
    {
      number: 7,
      text: "Gambar mana yang menunjukkan dua magnet saling tarik-menarik?",
      image: null,
      choices: ["", "", ""].map(choice),
      key: 2,
    },
  ],
};

/** happy-dom's own way to change the page's address. */
function goTo(url: string) {
  (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(url);
}

function view(): NemuDisplay {
  const display = quizImport.getView().display;
  if (!display) throw new Error("Nemu shows nothing");
  return display;
}

async function settle() {
  for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("F4-03 in the page (#210)", () => {
  test("she picks the script; Nemu asks what it couldn't read and the dates, then runs it in cara 1", async () => {
    goTo(URLS.course);
    const parsed = new DOMParser().parseFromString(coursePageHtml(true), "text/html");
    document.body.innerHTML = parsed.body.innerHTML;
    document.body.className = parsed.body.className;
    quizImport.connect({ pageEmail: { kind: "unreadable" }, honorific: "Bu", speak: () => {} });
    reading = {
      status: "ok",
      draft: DRAFT,
      questions: [
        {
          id: "key-4",
          kind: "key",
          soal: 4,
          prompt: "Kunci jawaban soal 4 tidak ada di naskah. Yang benar yang mana, Bu?",
          options: ["a", "b", "c"],
        },
        {
          id: "image-7-c",
          kind: "image",
          soal: 7,
          choice: 2,
          prompt:
            "Gambar pilihan c soal 7 tidak bisa Nemu ambil dari naskah. Lanjut bagaimana, Bu?",
          options: ["Lewati soal ini", "Gambarnya saya pasang nanti"],
        },
        {
          id: "section",
          kind: "section",
          prompt: "Kuis ini masuk ke bagian mana, Bu?",
          options: ["IPAS", "Bahasa Inggris", "Umum"],
        },
      ],
    };

    quizImport.start("Nemu, masukkan kuis dari naskah ini.");
    const pick = view();
    expect(pick).toMatchObject({
      type: "jawab",
      sentence: "Pilih naskah soalnya: PDF, Word, atau foto, Bu.",
    });
    if (pick.type !== "jawab") return;
    pick.action!.onSelect();
    const input = document.querySelector<HTMLInputElement>("input[type=file]")!;
    expect(input.accept).toContain(".pdf");
    Object.defineProperty(input, "files", {
      value: [new File(["%PDF-1.4"], "naskah.pdf", { type: "application/pdf" })],
    });
    input.dispatchEvent(new Event("change"));
    await settle();

    expect(requests[0]).toMatchObject({
      op: "read",
      input: {
        file: { name: "naskah.pdf", mimeType: "application/pdf" },
        utterance: "Nemu, masukkan kuis dari naskah ini.",
        course: "4A-UJI · Kelas 4A (uji)",
        sections: ["Umum", "IPAS", "Bahasa Inggris"],
      },
    });

    // Kartu Pilih, one question at a time, nothing pre-selected.
    const key = view();
    expect(key).toMatchObject({
      type: "pilih",
      question: "Kunci jawaban soal 4 tidak ada di naskah. Yang benar yang mana, Bu?",
    });
    expect(quizImport.getView().typing).toBe(true);
    // She says the letter the card doesn't show.
    expect(quizImport.hear("yang d")).toBe(true);
    const image = view();
    expect(image).toMatchObject({
      type: "pilih",
      note: "Pertanyaan 2 dari 3 · Nemu tidak mengisi soal sendiri.",
    });
    if (image.type !== "pilih") return;
    image.onChoose("0"); // Lewati soal ini
    const section = view();
    if (section.type !== "pilih") return;
    expect(section.choices.map((option) => option.label)).toEqual([
      "IPAS",
      "Bahasa Inggris",
      "Umum",
    ]);
    section.onChoose("0");

    // No dates in her words: asked, typed or spoken.
    expect(view()).toMatchObject({
      type: "jawab",
      sentence: "Kuisnya dibuka dan ditutup tanggal berapa, Bu.",
    });
    quizImport.hear("buka Senin 30 November");
    expect(view()).toMatchObject({ sentence: "Kuisnya ditutup tanggal berapa, Bu." });
    quizImport.hear("3 Desember jam 9 malam");
    const ready = view();
    expect(ready).toMatchObject({
      type: "jawab",
      sentence:
        "Jam bukanya tidak disebut, jadi kuis dibuka 30 November pukul 00.00 dan ditutup 3 Desember pukul 21.00, Bu.",
      status: { text: "2 soal siap" },
    });
    if (ready.type !== "jawab") return;
    expect(ready.notes?.ringkasan).toContain("Dilewati: soal 7");
    ready.action!.onSelect();
    await settle();

    expect(executor.start).toHaveBeenCalledTimes(1);
    const [task, options] = executor.start.mock.calls[0]!;
    expect(task.kind).toBe(QUIZ_IMPORT_KIND);
    expect(options.cara).toBe(1);
    const { plan } = options.continuation as ImportContinuation;
    expect(plan).toMatchObject({
      section: "IPAS",
      name: "Latihan IPAS Kelas 4A",
      opens: { date: "2026-11-30", time: "00:00" },
      closes: { date: "2026-12-03", time: "21:00" },
      fileName: "Latihan IPAS Kelas 4A.xml",
      count: 2,
    });
    expect(plan.xml).not.toContain("Soal 07");
    // Soal 4's key is the d she said.
    expect(plan.xml).toMatch(
      /<name><text>Soal 04<\/text><\/name>[\s\S]*fraction="100" format="html">\s*<text><!\[CDATA\[<p>kimia<\/p>\]\]>/u,
    );
    expect(quizImport.getView().display).toBeNull();

    // Once the questions are in, the F4-1 check runs with the one sentence and the import's notes.
    goTo(URLS.edit(9));
    const page = new DOMParser().parseFromString(quizEdit(9, 2), "text/html");
    document.body.innerHTML = page.body.innerHTML;
    document.body.className = page.body.className;
    const added = await sources.get(QUIZ_IMPORT_KIND)!({
      ...(options.continuation as ImportContinuation),
      phase: "added",
      cmid: 9,
      dropped: true,
    });
    expect(added).toEqual({ steps: [], continuation: null });
    finishers.get(QUIZ_IMPORT_KIND)!(
      { status: "done" },
      ["Nemu membuka Soal", "Bu menekan Impor"],
      true,
    );
    await settle();
    expect(quizCheck.start).toHaveBeenCalledWith("cek kuis ini, 2 soal", {
      ready:
        "Kuis Latihan IPAS Kelas 4A sudah siap: 2 soal, dibuka 30 November pukul 00.00 dan ditutup 3 Desember pukul 21.00, Bu.",
      before: [
        "Nemu membuka Soal",
        "Nemu menaruh berkas Latihan IPAS Kelas 4A.xml di Impor (seret dan lepas)",
        "Bu menekan Impor",
      ],
    });
  });

  test("off a course page Nemu asks her to open the course first", async () => {
    goTo(URLS.view(3));
    document.body.className = "path-mod-quiz cmid-3";
    quizImport.start("masukkan kuis dari naskah ini");
    expect(view()).toMatchObject({
      sentence:
        "Buka dulu halaman kursusnya di Moodle, lalu minta Nemu memasukkan kuisnya lagi, Bu.",
    });
    expect(quizImport.hear("lanjut")).toBe(false);
  });
});
