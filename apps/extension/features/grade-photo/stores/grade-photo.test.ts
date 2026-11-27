// @vitest-environment happy-dom
import type { GradeSheetReading, InboxJob, VerificationPlan } from "@nemu/contracts/school";
import type { NemuDisplay } from "@nemu/ui/lib/nemu-display";
import { beforeAll, describe, expect, test, vi } from "vite-plus/test";

import type { GradePhotoRequest } from "../lib/requests";

const calls: GradePhotoRequest[] = [];
const replies: Partial<Record<GradePhotoRequest["op"], (request: never) => unknown>> = {};

vi.mock("../api/request-grade-photo", () => ({
  requestGradePhoto: async (_pageEmail: unknown, request: GradePhotoRequest) => {
    calls.push(request);
    const reply = replies[request.op];
    return { ok: true, value: reply ? reply(request as never) : null };
  },
}));

const finishers = new Map<string, (...args: unknown[]) => void>();
const executor = {
  registerFinisher: (kind: string, finisher: (...args: unknown[]) => void) =>
    finishers.set(kind, finisher),
  start: vi.fn(async () => undefined),
  presentNotes: vi.fn(),
};
vi.mock("../../executor/stores/executor", () => ({ executor }));

const { gradePhoto } = await import("./grade-photo");

const READING = { rows: [], columns: [] } as unknown as GradeSheetReading;
const VERIFICATION: VerificationPlan = {
  questions: [
    {
      id: "cell-3-c1",
      kind: "digit",
      line: 3,
      column: "c1",
      studentName: "Alya Nur Fitri",
      prompt: "Nilai Alya Nur Fitri: 86 atau 88?",
      options: ["86", "88"],
      box: [600, 150, 700, 170],
    },
    {
      id: "cell-21-c1",
      kind: "absence",
      line: 21,
      column: "c1",
      studentName: "Putra Wijaya",
      code: "S",
      prompt: "Putra Wijaya: S (sakit). Nilai dikosongkan?",
      options: ["Kosongkan"],
      box: null,
    },
  ],
  acceptedCount: 30,
  acceptedSentence: "30 nilai lain sudah cocok.",
};
const JOB: InboxJob = {
  jobId: "job-1",
  source: "whatsapp",
  status: "queued",
  createdAt: 1,
  reading: null,
  verification: null,
  message: null,
};

const spoken: string[] = [];
let filled: { kind: string; steps: { verb: string }[] } | undefined;
const view = () => gradePhoto.getView();
const until = async (check: () => boolean) => {
  for (let tries = 0; tries < 50 && !check(); tries += 1)
    await new Promise((resolve) => setTimeout(resolve, 5));
  expect(check()).toBe(true);
};
function choose(display: NemuDisplay | null, label: string) {
  if (display?.type !== "pilih") throw new Error(`no Kartu Pilih: ${display?.type}`);
  const choice = display.choices.find((item) => item.label === label);
  if (!choice) throw new Error(`no choice ${label}`);
  display.onChoose(choice.id);
}

beforeAll(() => {
  replies.poll = () => [JOB];
  replies.command = (request: { utterance: string }) =>
    /4B/u.test(request.utterance)
      ? { status: "ok", className: "4B", subject: "Matematika", assessment: "UTS" }
      : { status: "ask", missing: "className", question: "Nilai kelas berapa, Bu?" };
  replies.process = () => ({
    ...JOB,
    status: "ready",
    reading: READING,
    verification: VERIFICATION,
  });
  replies.crops = () => ["data:image/jpeg;base64,AA", null];
  replies.finalize = () => ({
    status: "ok",
    column: "c1",
    entries: [
      { studentId: "s-3", name: "Alya Nur Fitri", value: 86, status: "value", remedial: false },
      { studentId: "s-21", name: "Putra Wijaya", value: null, status: "S", remedial: false },
    ],
    summary: { filled: 1, blank: 1, remedial: 0 },
    citations: {},
    summarySentence: "1 nilai, 1 kosong.",
  });
  replies.readback = () => ({
    match: true,
    mismatches: [],
    sentence: "2 nilai tersimpan dan sesuai.",
    source: "alursekolah",
  });
  replies.ack = () => ({ deleted: true });
  gradePhoto.connect({
    pageEmail: { kind: "read", email: "siti.aminah@sditnusantara.sch.id" },
    honorific: "Bu",
    registered: true,
    speak: (text) => spoken.push(text),
  });
});

describe("F1 from the WhatsApp photo to the read-back (#207)", () => {
  test("a new photo shows as the small Foto dari WhatsApp card; Mulai asks what the grades are", async () => {
    await until(() => view().card !== null);
    expect(view().card).toMatchObject({
      type: "pilih",
      compact: true,
      question: "Foto dari WhatsApp",
    });
    choose(view().card, "Mulai");
    await until(() => view().typing);
    expect(calls).toContainEqual({ op: "hold", jobId: "job-1" });
    expect(view().display).toMatchObject({ type: "jawab" });
    expect(spoken.at(-1)).toMatch(/Nilai apa ini, Ibu\?/u);
  });

  test("the command asks for anything missing, then the photo is read", async () => {
    expect(gradePhoto.hear("nilai UTS Matematika")).toBe(true);
    await until(() => spoken.at(-1) === "Nilai kelas berapa, Bu?");
    gradePhoto.hear("4B");
    await until(() => view().display?.type === "pilih");
    expect(calls).toContainEqual({
      op: "command",
      utterance: "nilai UTS Matematika 4B",
    });
    expect(calls).toContainEqual({
      op: "process",
      jobId: "job-1",
      className: "4B",
      assessment: "UTS",
    });
  });

  test("W5: one Kartu Pilih per question with its crop, answered by button or voice", async () => {
    const first = view().display;
    expect(first).toMatchObject({
      type: "pilih",
      question: "Nilai Alya Nur Fitri: 86 atau 88?",
      image: { src: "data:image/jpeg;base64,AA" },
      note: "Pertanyaan 1 dari 2. 30 nilai lain sudah cocok.",
    });
    expect(view().card).toBeNull();
    choose(first, "Angka lain");
    expect(view().typing).toBe(true);
    gradePhoto.hear("delapan puluh enam");
    expect(view().display).toMatchObject({
      question: "Putra Wijaya: S (sakit). Nilai dikosongkan?",
    });
    expect(gradePhoto.hear("kosongkan")).toBe(true);
    await until(() => executor.start.mock.calls.length === 1);
    filled = (executor.start.mock.calls[0] as unknown[])[0] as typeof filled;
    expect(calls).toContainEqual({
      op: "finalize",
      reading: READING,
      answers: [
        { questionId: "cell-3-c1", answer: "86" },
        { questionId: "cell-21-c1", answer: "Kosongkan" },
      ],
    });
  });

  test("the executor fills in cara 1 and stops at Simpan; Lihat ringkasan holds the numbers", () => {
    const task = filled!;
    expect(task.kind).toBe("f1-isi-nilai");
    expect(task.steps.at(-1)).toMatchObject({
      verb: "point",
      sentence: "Silakan Ibu tekan Simpan.",
      ringkasan: "1 nilai, 1 kosong. Alya Nur Fitri 86, Putra Wijaya kosong (tidak hadir).",
    });
    expect(view().display).toBeNull();
  });

  test("after the save, the read-back is said in one sentence, the photo deleted, then Catatan langkah", async () => {
    finishers.get("f1-isi-nilai")!(
      { status: "done", startCara: 1, task: { kind: "f1-isi-nilai" } },
      ["Sumber: Foto buku nilai dari WhatsApp", "Nemu mengisi 3 isian", "Bu menekan Simpan"],
      true,
    );
    await until(() => view().display?.type === "jawab");
    expect(calls.some((call) => call.op === "readback")).toBe(false);
    document.body.innerHTML = `<div role="status">Nilai tersimpan. 1 nilai Matematika UTS kelas 4B.</div>`;
    await until(() => {
      const display = view().display;
      return display?.type === "jawab" && display.sentence === "2 nilai tersimpan dan sesuai.";
    });
    expect(spoken.at(-1)).toBe("2 nilai tersimpan dan sesuai.");
    expect(calls).toContainEqual({ op: "ack", jobId: "job-1" });
    const done = view().display;
    if (done?.type !== "jawab") throw new Error("no answer");
    done.action?.onSelect();
    expect(executor.presentNotes).toHaveBeenCalledWith(
      [
        "Sumber: Foto buku nilai dari WhatsApp",
        "Bu menjawab 2 pertanyaan tentang foto",
        "Nemu mengisi 3 isian",
        "Bu menekan Simpan",
        "Nemu membaca ulang 2 nilai dari AlurSekolah: semua sesuai",
        "Foto buku nilai dihapus dari Nemu",
      ],
      "f1-isi-nilai",
      true,
    );
    expect(view().display).toBeNull();
  });
});
