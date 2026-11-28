// @vitest-environment happy-dom
import type { ExecutorStep, ExecutorTask } from "@nemu/contracts/executor";
import type { NemuDisplay } from "@nemu/ui/lib/nemu-display";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import {
  CURSOR_GLIDE_MS,
  createRunState,
  ExecutorRun,
  type RunDeps,
  type RunState,
  type StepSource,
} from "./run";
import { toSafeTask } from "./safety";
import { F0_1_FILE } from "./test-responses";

/** A small Isi nilai kelas page: the menu, the class select, two grade rows and Simpan. */
function gradePage() {
  document.body.innerHTML = `
    <nav><a href="#/nilai">Nilai</a></nav>
    <label for="kelas">Kelas</label>
    <select id="kelas"><option value="">Pilih kelas</option><option>4A</option><option>4B</option></select>
    <table><tbody>
      <tr><td>Ahmad Fadli</td><td><input type="number" aria-label="Nilai Ahmad Fadli"></td></tr>
      <tr><td>Aisyah Zahra</td><td><input type="number" aria-label="Nilai Aisyah Zahra"></td></tr>
    </tbody></table>
    <button id="simpan">Simpan</button>`;
  const presses = { simpan: 0, menu: 0 };
  document.getElementById("simpan")?.addEventListener("click", () => (presses.simpan += 1));
  document.querySelector("a")?.addEventListener("click", (event) => {
    event.preventDefault();
    presses.menu += 1;
  });
  return presses;
}

const field = (name: string) =>
  document.querySelector(`[aria-label='Nilai ${name}']`) as HTMLInputElement;

const GRADES: ExecutorTask = {
  kind: "isi-nilai",
  title: "Isi nilai UTS Matematika 4B",
  steps: [
    { verb: "clickMenu", target: { role: "link", text: "Nilai" } },
    { verb: "selectOption", target: { label: "Kelas" }, option: "4B" },
    {
      verb: "setValue",
      target: { label: "Nilai Ahmad Fadli" },
      value: "80",
      rowName: "Ahmad Fadli",
    },
    {
      verb: "setValue",
      target: { label: "Nilai Aisyah Zahra" },
      value: "92",
      rowName: "Aisyah Zahra",
    },
    {
      verb: "point",
      target: { role: "button", text: "Simpan" },
      sentence: "Silakan Bu tekan Simpan.",
    },
  ],
};

function harness(state: RunState, extra: Partial<RunDeps> = {}) {
  const shown: { display: NemuDisplay | null; target: Element | null }[] = [];
  const log: Parameters<RunDeps["log"]>[0][] = [];
  const spoken: string[] = [];
  const ended = vi.fn<RunDeps["onEnd"]>();
  const run = new ExecutorRun(state, {
    doc: document,
    honorific: "Bu",
    fieldMs: 1000,
    render: ({ display, target }) => shown.push({ display, target }),
    speak: (text) => spoken.push(text),
    // Time passes instantly, but each wait still lets the page and the test run.
    sleep: () => new Promise((resolve) => setTimeout(resolve, 0)),
    log: (entry) => log.push(entry),
    save: () => undefined,
    onEnd: ended,
    // happy-dom events are never trusted; here every test-made event stands for the teacher.
    isTrusted: () => true,
    ...extra,
  });
  const display = () => shown.at(-1)?.display ?? null;
  return { run, shown, log, spoken, ended, display };
}

/** Time passes instantly until `hold` says so; then Nemu waits until it is interrupted. */
function holdWhen(hold: () => boolean): RunDeps["sleep"] {
  return (_ms, signal) =>
    new Promise((resolve) => {
      if (!hold()) return void setTimeout(resolve, 0);
      signal.addEventListener("abort", () => resolve(), { once: true });
    });
}

/** The teacher presses a button with her own mouse. */
function press(element: Element) {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

/** The teacher types into a field and leaves it. */
function typeAsTeacher(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

let presses: ReturnType<typeof gradePage>;
beforeEach(() => {
  presses = gradePage();
});

describe("cara 1", () => {
  test("opens the menu, fills each value digit by digit, ticks the rows and stops at Simpan", async () => {
    const typed: string[] = [];
    field("Ahmad Fadli").addEventListener("input", (event) =>
      typed.push((event.target as HTMLInputElement).value),
    );
    const { run, log, spoken, ended, display, shown } = harness(
      createRunState(GRADES, { cara: 1 }),
    );
    void run.run();

    await vi.waitFor(() => expect(run.waiting).toEqual({ refused: false }));
    expect(presses.menu).toBe(1);
    expect((document.getElementById("kelas") as HTMLSelectElement).value).toBe("4B");
    expect(field("Ahmad Fadli").value).toBe("80");
    expect(field("Aisyah Zahra").value).toBe("92");
    expect(typed).toEqual(["", "8", "80"]);
    // The first two rows are read aloud; the menu is named as Nemu opens it.
    expect(spoken).toEqual(
      expect.arrayContaining(["Membuka Nilai…", "Ahmad Fadli, 80.", "Aisyah Zahra, 92."]),
    );
    expect(shown.some(({ display }) => display?.type === "kerja")).toBe(true);
    // Simpan is pointed at, never pressed.
    expect(display()).toMatchObject({ type: "tunjuk", sentence: "Silakan Bu tekan Simpan." });
    expect(presses.simpan).toBe(0);
    expect(run.state.ticked).toEqual([1, 2, 3]);

    press(document.getElementById("simpan") as Element);
    await vi.waitFor(() => expect(ended).toHaveBeenCalled());
    expect(run.state.status).toBe("done");
    expect(ended.mock.calls[0]?.[1]).toEqual([
      "Nemu membuka Nilai",
      "Nemu memilih 4B di Kelas",
      "Nemu mengisi 2 isian",
      "Bu menekan Simpan",
    ]);
    // WS-10: every action logged by target, never by value.
    expect(log.map(({ action, result }) => `${action}:${result}`)).toEqual([
      "clickMenu:done",
      "selectOption:done",
      "setValue:done",
      "setValue:done",
      "point:teacher",
      "finish:done",
    ]);
    expect(JSON.stringify(log)).not.toMatch(/80|92/u);
  });

  test("Pelan makes each wait twice as long", async () => {
    const waits: number[] = [];
    const { run } = harness(
      createRunState({ ...GRADES, steps: GRADES.steps.slice(2, 3) }, { cara: 1 }),
      {
        sleep: (ms) => {
          waits.push(ms);
          return Promise.resolve();
        },
      },
    );
    run.setSlow(true);
    await run.run();
    // Glide, then two digits at 2 × 120 ms.
    expect(waits.slice(0, 3)).toEqual([600, 240, 240]);
  });
});

describe("F0-13: a step that loads another page", () => {
  test("'Membuka Nilai…' is up and said before Nemu clicks the menu, long enough to read", async () => {
    // A clock that moves only when Nemu waits. The stage shows a display about an element once
    // the cursor has glided there (CURSOR_GLIDE_MS after the render), so that is when the
    // teacher first sees the line.
    let now = 0;
    let shownAt = null as number | null;
    let saidAt = null as number | null;
    let clickedAt = null as number | null;
    document.querySelector("a")?.addEventListener("click", () => (clickedAt ??= now));
    const { run } = harness(
      createRunState({ ...GRADES, steps: GRADES.steps.slice(0, 1) }, { cara: 1 }),
      {
        render: ({ display }) => {
          if (display?.type === "kerja" && display.sentence === "Membuka Nilai…")
            shownAt ??= now + CURSOR_GLIDE_MS;
        },
        speak: (text) => {
          if (text === "Membuka Nilai…") saidAt ??= now;
        },
        sleep: (ms) => {
          now += ms;
          return Promise.resolve();
        },
      },
    );
    await run.run();

    expect(clickedAt).not.toBeNull();
    expect(shownAt).not.toBeNull();
    expect(saidAt).not.toBeNull();
    expect(Number(saidAt)).toBeLessThan(Number(clickedAt));
    expect(Number(clickedAt) - Number(shownAt)).toBeGreaterThanOrEqual(500);
  });

  test("a switch like Moodle's Mode Edit is saved as done the moment it is switched", async () => {
    document.body.innerHTML = `<input type="checkbox" role="switch" id="mode"><label for="mode">Mode Edit</label>`;
    const order: string[] = [];
    const task: ExecutorTask = {
      kind: "tunjuk",
      title: "Mode Edit",
      steps: [{ verb: "check", target: { role: "checkbox", label: "Mode Edit" }, checked: true }],
    };
    // The page reloads soon after the switch changes, so the next wait may never end.
    document.getElementById("mode")?.addEventListener("change", () => order.push("switched"));
    const { run } = harness(createRunState(task, { cara: 1 }), {
      save: (state) => order.push(`saved ${state.index}`),
      sleep: () => {
        order.push("wait");
        return new Promise((resolve) => setTimeout(resolve, 0));
      },
    });
    await run.run();
    const switched = order.indexOf("switched");
    expect(order.slice(switched, switched + 2)).toEqual(["switched", "saved 1"]);
  });
});

describe("pointing at Simpan", () => {
  test("a point step's ringkasan sits behind Lihat ringkasan beside the button (F1)", async () => {
    gradePage();
    const { run, display } = harness(
      createRunState(
        {
          ...GRADES,
          steps: [
            {
              verb: "point",
              target: { role: "button", text: "Simpan" },
              sentence: "Silakan Ibu tekan Simpan.",
              ringkasan: "Ahmad Fadli 80, Aisyah Zahra 92.",
            },
          ],
        },
        { cara: 1 },
      ),
    );
    void run.run();
    await vi.waitFor(() => expect(run.waiting).toEqual({ refused: false }));
    expect(display()).toEqual({
      type: "tunjuk",
      sentence: "Silakan Ibu tekan Simpan.",
      note: { ringkasan: "Ahmad Fadli 80, Aisyah Zahra 92." },
    });
    run.stop(false);
  });
});

describe("F0-1: a fake AI response that tries to press", () => {
  test.each(F0_1_FILE.respons.map((response) => [response.title, response] as const))(
    "%s: nothing is pressed or submitted, and Nemu points instead",
    async (_title, response) => {
      // The fixture runs on the mock's full page; here only its last two steps: one value, then
      // the press. The page's first row stands in for the student the response fills.
      const { task, refused } = toSafeTask(response);
      const [fill, press] = task.steps.slice(-2) as [ExecutorStep, ExecutorStep];
      const label = fill.target.label ?? "";
      if (!document.querySelector(`[aria-label='${label}']`))
        field("Ahmad Fadli").setAttribute("aria-label", label);
      const tail: ExecutorTask = { ...task, steps: [fill, press] };
      const submits: Event[] = [];
      document.addEventListener("submit", (event) => submits.push(event), true);
      const { run, display, log } = harness(
        createRunState(tail, { cara: 1, refused: refused.length ? [1] : [] }),
      );
      void run.run();
      await vi.waitFor(() => expect(run.waiting).toEqual({ refused: true }));
      expect(presses.simpan).toBe(0);
      expect(submits).toEqual([]);
      expect(display()).toMatchObject({
        type: "tunjuk",
        sentence: "Yang ini Bu tekan sendiri. Nemu hanya menunjuk.",
      });
      expect(log.at(-1)).toMatchObject({ result: "refused" });
      run.stop(false);
    },
  );
});

describe("F0-07: the teacher's own input stops Nemu", () => {
  test("Kartu Pilih offers Saya isi sendiri, Nemu lanjut and Berhenti; Saya isi sendiri is cara 2", async () => {
    const { run, display } = harness(createRunState(GRADES, { cara: 1 }), {
      sleep: holdWhen(() => true),
    });
    void run.run();
    await vi.waitFor(() => expect(display()).toMatchObject({ type: "kerja" }));
    run.interrupt();
    expect(run.state.status).toBe("asking");
    const card = display();
    expect(card).toMatchObject({
      type: "pilih",
      choices: [
        { id: "sendiri", label: "Saya isi sendiri" },
        { id: "lanjut", label: "Nemu lanjut" },
        { id: "berhenti", label: "Berhenti" },
      ],
    });
    if (card?.type !== "pilih") throw new Error("expected Kartu Pilih");
    card.onChoose("sendiri");
    await vi.waitFor(() => expect(display()).toMatchObject({ type: "tunjuk" }));
    expect(run.state.cara).toBe(2);
    expect(run.state.status).toBe("running");
  });

  test("Berhenti keeps what was filled and ends with Catatan langkah", async () => {
    const { run, display, ended } = harness(createRunState(GRADES, { cara: 1 }), {
      sleep: holdWhen(() => field("Ahmad Fadli").value === "80"),
    });
    void run.run();
    await vi.waitFor(() => expect(field("Ahmad Fadli").value).toBe("80"));
    run.interrupt();
    const card = display();
    if (card?.type !== "pilih") throw new Error("expected Kartu Pilih");
    card.onChoose("berhenti");
    expect(run.state.status).toBe("stopped");
    expect(field("Ahmad Fadli").value).toBe("80");
    expect(ended.mock.calls[0]?.[1].at(-1)).toMatch(
      /^Berhenti di langkah \d dari 5; isian tetap ada$/u,
    );
  });
});

describe("F0-11: Berhenti in the Gelembung Kerja asks whether she fills the rest herself", () => {
  /** Nemu holds on Aisyah Zahra's row, after filling Ahmad Fadli's; Berhenti is pressed there. */
  async function pressBerhenti() {
    const { run, display, ended, log } = harness(createRunState(GRADES, { cara: 1 }), {
      sleep: holdWhen(() => run.state.index === 3),
    });
    void run.run();
    await vi.waitFor(() =>
      expect(display()).toMatchObject({ type: "kerja", sentence: "Mengisi Nilai Aisyah Zahra." }),
    );
    const bubble = display();
    if (bubble?.type !== "kerja") throw new Error("expected Gelembung Kerja");
    bubble.onStop();
    return { run, display, ended, log };
  }

  test("Nemu stops acting and asks one Kartu Pilih, Ya first and nothing risky", async () => {
    const { run, display, ended } = await pressBerhenti();
    expect(run.state.status).toBe("asking");
    expect(run.isActing()).toBe(false);
    expect(ended).not.toHaveBeenCalled();
    expect(display()).toEqual({
      type: "pilih",
      question: "Nemu berhenti. Bu mau isi sendiri?",
      choices: [
        { id: "sendiri", label: "Ya, saya isi sendiri" },
        { id: "berhenti", label: "Tidak, berhenti" },
      ],
      onChoose: expect.any(Function),
    });
  });

  test("Ya, saya isi sendiri goes on in cara 2 from the row Nemu was on", async () => {
    const { run, display, ended } = await pressBerhenti();
    const card = display();
    if (card?.type !== "pilih") throw new Error("expected Kartu Pilih");
    card.onChoose("sendiri");
    await vi.waitFor(() =>
      expect(display()).toMatchObject({ type: "tunjuk", sentence: "Ketik 92 untuk Aisyah Zahra." }),
    );
    expect(run.state.cara).toBe(2);
    expect(run.state.status).toBe("running");
    expect(field("Ahmad Fadli").value).toBe("80");
    typeAsTeacher(field("Aisyah Zahra"), "92");
    await vi.waitFor(() =>
      expect(display()).toMatchObject({ type: "tunjuk", sentence: "Silakan Bu tekan Simpan." }),
    );
    expect(presses.simpan).toBe(0);
    expect(ended).not.toHaveBeenCalled();
  });

  test("Tidak, berhenti ends as before: inputs kept, Catatan langkah, nothing pressed", async () => {
    const { run, display, ended, log } = await pressBerhenti();
    const card = display();
    if (card?.type !== "pilih") throw new Error("expected Kartu Pilih");
    card.onChoose("berhenti");
    expect(run.state.status).toBe("stopped");
    expect(field("Ahmad Fadli").value).toBe("80");
    expect(presses.simpan).toBe(0);
    expect(ended).toHaveBeenCalledOnce();
    expect(ended.mock.calls[0]?.[2]).toBe(true);
    expect(ended.mock.calls[0]?.[1].at(-1)).toBe("Berhenti di langkah 4 dari 5; isian tetap ada");
    expect(log.at(-1)).toEqual({ action: "stop", target: "", result: "stopped" });
  });

  test("the voice command and the other Berhenti buttons still end at once", async () => {
    const { run, ended } = harness(createRunState(GRADES, { cara: 1 }), {
      sleep: holdWhen(() => run.state.index === 3),
    });
    void run.run();
    await vi.waitFor(() => expect(run.state.index).toBe(3));
    run.stop();
    expect(run.state.status).toBe("stopped");
    expect(ended).toHaveBeenCalledOnce();
  });
});

describe("F0-06: a missing or ambiguous target", () => {
  test("stops and asks instead of guessing", async () => {
    document.body.insertAdjacentHTML("beforeend", "<a href='#/lain'>Nilai</a>");
    const { run, display } = harness(createRunState(GRADES, { cara: 1 }));
    await run.run();
    expect(run.state.status).toBe("asking");
    expect(presses.menu).toBe(0);
    expect(display()).toMatchObject({
      type: "pilih",
      question: "Ada 2 Nilai di halaman ini. Lanjut bagaimana?",
    });
  });
});

describe("F0-09: a lost connection", () => {
  test("retries twice with a plain message, stops with the inputs kept, and 'lanjut' resumes", async () => {
    let failures = 3;
    const source: StepSource = async () => {
      if (failures-- > 0) throw new Error("offline");
      return { steps: GRADES.steps.slice(3), continuation: null };
    };
    const { run, shown, display } = harness(
      createRunState(
        { ...GRADES, steps: GRADES.steps.slice(0, 3) },
        { cara: 1, continuation: "next" },
      ),
      { source },
    );
    await run.run();
    expect(run.state.status).toBe("offline");
    expect(
      shown.filter(
        ({ display }) => display?.type === "kerja" && display.sentence.startsWith("Koneksi"),
      ),
    ).toHaveLength(2);
    expect(display()).toMatchObject({
      type: "jawab",
      sentence: "Koneksi terputus, jadi Nemu berhenti dulu. Isian tetap ada.",
      action: { label: "Lanjut" },
    });
    expect(field("Ahmad Fadli").value).toBe("80");

    run.resume();
    await vi.waitFor(() => expect(field("Aisyah Zahra").value).toBe("92"));
    await vi.waitFor(() => expect(run.waiting).toEqual({ refused: false }));
  });
});

describe("cara 2 and 3", () => {
  test("cara 2 points and says the value, then checks what the teacher typed", async () => {
    const task = { ...GRADES, steps: GRADES.steps.slice(2) };
    const { run, display } = harness(createRunState(task, { cara: 2 }));
    void run.run();
    await vi.waitFor(() =>
      expect(display()).toMatchObject({ type: "tunjuk", sentence: "Ketik 80 untuk Ahmad Fadli." }),
    );
    typeAsTeacher(field("Ahmad Fadli"), "70");
    expect(display()).toMatchObject({ sentence: "Di daftar tertulis 80." });
    expect(run.state.index).toBe(0);
    typeAsTeacher(field("Ahmad Fadli"), "80");
    await vi.waitFor(() =>
      expect(display()).toMatchObject({ sentence: "Ketik 92 untuk Aisyah Zahra." }),
    );
    expect(run.state.ticked).toEqual([0]);
  });

  test("cara 2 passes over a field that already holds the right value", async () => {
    field("Aisyah Zahra").value = "92";
    const task = { ...GRADES, steps: GRADES.steps.slice(2) };
    const { run, display } = harness(createRunState(task, { cara: 2 }));
    void run.run();
    await vi.waitFor(() =>
      expect(display()).toMatchObject({ sentence: "Ketik 80 untuk Ahmad Fadli." }),
    );
    typeAsTeacher(field("Ahmad Fadli"), "80");
    await vi.waitFor(() =>
      expect(display()).toMatchObject({ type: "tunjuk", sentence: "Silakan Bu tekan Simpan." }),
    );
    expect(run.state.ticked).toEqual([0, 1]);
  });

  test("'Ajari saya' switches a cara 1 run to cara 2 at the current step", async () => {
    const { run, display } = harness(createRunState(GRADES, { cara: 1 }), {
      sleep: holdWhen(() => run.state.index === 2),
    });
    void run.run();
    await vi.waitFor(() =>
      expect(display()).toMatchObject({ sentence: "Mengisi Nilai Ahmad Fadli." }),
    );
    run.teach();
    await vi.waitFor(() =>
      expect(display()).toMatchObject({ type: "tunjuk", sentence: "Ketik 80 untuk Ahmad Fadli." }),
    );
    expect(run.state.cara).toBe(2);
  });

  test("cara 3 waits for Simpan, then reports what doesn't match", async () => {
    const { run, display, ended } = harness(createRunState(GRADES, { cara: 3 }));
    void run.run();
    await vi.waitFor(() =>
      expect(display()).toMatchObject({
        type: "jawab",
        sentence: "Silakan Bu isi sendiri. Nemu memeriksa setelah Bu menekan Simpan.",
      }),
    );
    (document.getElementById("kelas") as HTMLSelectElement).value = "4B";
    field("Ahmad Fadli").value = "80";
    field("Aisyah Zahra").value = "29";
    press(document.getElementById("simpan") as Element);
    await vi.waitFor(() =>
      expect(display()).toMatchObject({
        type: "jawab",
        sentence: "1 dari 3 isian belum sesuai.",
        notes: { ringkasan: "Nilai Aisyah Zahra: tertulis 29, di daftar 92" },
      }),
    );
    const result = display();
    if (result?.type !== "jawab") throw new Error("expected Gelembung Jawab");
    result.action?.onSelect();
    await vi.waitFor(() => expect(ended).toHaveBeenCalled());
    expect(ended.mock.calls[0]?.[1]).toContain("Nemu memeriksa 3 isian: 1 belum sesuai");
  });
});

describe("WS-03 site permission", () => {
  test("on a 'baca saja' site a cara 1 run fills and clicks nothing: Nemu points, the teacher acts", async () => {
    const task = { ...GRADES, steps: [GRADES.steps[0]!, GRADES.steps[2]!] };
    const { run, log, display } = harness(createRunState(task, { cara: 1 }), {
      permission: "read_only",
    });
    void run.run();

    await vi.waitFor(() =>
      expect(display()).toMatchObject({ type: "tunjuk", sentence: "Klik Nilai." }),
    );
    expect(presses.menu).toBe(0);
    press(document.querySelector("a") as Element);
    await vi.waitFor(() =>
      expect(display()).toMatchObject({ sentence: "Ketik 80 untuk Ahmad Fadli." }),
    );
    expect(field("Ahmad Fadli").value).toBe("");
    typeAsTeacher(field("Ahmad Fadli"), "80");
    await vi.waitFor(() => expect(run.state.ticked).toEqual([1]));
    expect(log).toEqual(
      expect.arrayContaining([
        { action: "clickMenu", target: "Nilai", result: "refused" },
        { action: "setValue", target: "Nilai Ahmad Fadli", result: "refused" },
      ]),
    );
  });

  test("on a 'siapkan pesan' site Nemu types the text but leaves clicks to the teacher", async () => {
    const task = { ...GRADES, steps: [GRADES.steps[0]!, GRADES.steps[2]!] };
    const { run, display } = harness(createRunState(task, { cara: 1 }), {
      permission: "prepare_message",
    });
    void run.run();
    await vi.waitFor(() => expect(display()).toMatchObject({ sentence: "Klik Nilai." }));
    press(document.querySelector("a") as Element);
    await vi.waitFor(() => expect(field("Ahmad Fadli").value).toBe("80"));
  });
});
