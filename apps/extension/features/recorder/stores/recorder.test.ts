// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { RecorderRequest } from "../lib/requests";

const requests: RecorderRequest[] = [];
let stored: unknown = null;
vi.mock("../api/request-recorder", () => ({
  requestRecorder: async (_pageEmail: unknown, request: RecorderRequest) => {
    requests.push(request);
    if (request.op === "state-save") stored = structuredClone(request.state);
    if (request.op === "state-load") return { ok: true, value: stored };
    if (request.op === "save")
      return { ok: true, value: { recordingId: "rec-1", recordedBy: "Pak Rizal" } };
    return { ok: true, value: null };
  },
}));

const { recorder, firstName } = await import("./recorder");

const spoken: string[] = [];

beforeEach(() => {
  requests.length = 0;
  spoken.length = 0;
  stored = null;
  document.body.innerHTML = `
    <label for="kelas">Kelas</label><select id="kelas"><option value="">Pilih</option><option>4A</option></select>
    <label for="mapel">Mata pelajaran</label><select id="mapel"><option value="">Pilih</option><option>IPAS</option></select>
    <label for="tanggal">Tanggal</label><input type="date" id="tanggal">
    <label for="nilai">Nilai</label><input type="number" id="nilai">`;
  recorder.connect({
    pageEmail: { kind: "unreadable" },
    honorific: "Pak",
    name: "Rizal",
    talkKeys: "Ctrl + Spasi",
    speak: (text) => spoken.push(text),
  });
  recorder.start("Input nilai per kelas");
});

/** What the operator does on the page: a choice or a typed value, as the page fires it. */
function enter(selector: string, value: string) {
  const field = document.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
  field.value = value;
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function shown() {
  const recording = recorder.getView().recording;
  if (!recording) throw new Error("Nemu isn't recording");
  return recording;
}

function savedSteps(): number {
  const save = requests.find((request) => request.op === "save");
  if (save?.op !== "save") throw new Error("nothing was saved");
  return save.events.length;
}

describe("Rekam cara", () => {
  test("records with the operator's first name, the talk hint until there's an explanation", () => {
    expect(firstName("Siti Aminah, S.Pd.")).toBe("Siti");
    expect(shown()).toMatchObject({
      status: { tone: "nemu", text: "Merekam", count: "Rizal" },
      sentence: "Nemu merekam “Input nilai per kelas”.",
      detail: "Klik dan isian ikut tercatat. Tahan Ctrl + Spasi untuk menjelaskan.",
      paused: false,
      steps: 0,
    });
    expect(recorder.getView().display).toBeNull();

    enter("#kelas", "4A");
    recorder.talkStarted();
    expect(recorder.narrate("Isi nilai satu per satu sesuai buku.")).toBe(true);
    expect(shown()).toMatchObject({
      sentence: "“Isi nilai satu per satu sesuai buku.”",
      detail: "Klik dan isian ikut tercatat.",
      steps: 1,
    });
  });

  test("Jeda records nothing done or said until Lanjut, and the steps carry on without a gap", () => {
    enter("#kelas", "4A");
    enter("#mapel", "IPAS");
    recorder.talkStarted();
    recorder.narrate("Pilih kelas dulu.");

    shown().onPause();
    expect(shown()).toMatchObject({
      status: { tone: "muted", text: "Dijeda", count: "Rizal" },
      sentence: "Rekaman dijeda.",
      paused: true,
      steps: 2,
    });
    enter("#tanggal", "2026-11-30");
    recorder.talkStarted();
    // Said during Jeda: let go, not recorded and not asked as a question.
    expect(recorder.narrate("Ini cuma coba-coba.")).toBe(true);
    expect(shown().steps).toBe(2);
    expect(recorder.snapshot()?.narration.map((segment) => segment.text)).toEqual([
      "Pilih kelas dulu.",
    ]);
    // A second Jeda changes nothing.
    shown().onPause();
    expect(shown().paused).toBe(true);

    shown().onResume();
    expect(shown()).toMatchObject({ status: { text: "Merekam" }, paused: false, steps: 2 });
    enter("#tanggal", "2026-12-01");
    enter("#nilai", "90");
    expect(shown().steps).toBe(4);
    const values = recorder.snapshot()?.events.map((event) => event.value);
    expect(values).toEqual(["4A", "IPAS", "2026-12-01", "90"]);
  });

  test("Selesai during Jeda saves what was recorded before it", async () => {
    enter("#kelas", "4A");
    shown().onPause();
    enter("#mapel", "IPAS");
    await recorder.finish();

    expect(savedSteps()).toBe(1);
    expect(recorder.getView()).toMatchObject({
      recording: null,
      display: { type: "jawab", sentence: expect.stringMatching(/^Rekaman tersimpan: 1 langkah/u) },
    });
    expect(stored).toBeNull();
    // Nothing listens to the page any more.
    enter("#nilai", "90");
    expect(recorder.snapshot()).toBeNull();
  });

  test("Selesai with nothing recorded says so and forgets the recording", async () => {
    shown().onPause();
    await recorder.finish();
    expect(recorder.getView().display).toMatchObject({
      sentence: "Belum ada langkah yang terekam.",
    });
    expect(stored).toBeNull();
  });

  test("after a page load during Jeda the recording comes back paused", async () => {
    enter("#kelas", "4A");
    shown().onPause();
    const kept = stored;
    recorder.getView().recording?.onFinish();
    await vi.waitFor(() => expect(recorder.getView().recording).toBeNull());

    stored = kept;
    await recorder.restore();
    expect(shown()).toMatchObject({ paused: true, steps: 1 });
    enter("#mapel", "IPAS");
    expect(shown().steps).toBe(1);
    shown().onResume();
    enter("#mapel", "IPAS");
    expect(shown().steps).toBe(2);
  });
});
