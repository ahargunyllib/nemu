// @vitest-environment happy-dom
import { describe, expect, test } from "vite-plus/test";

import { guardSubmits, isTeacherInput, refusalFor, sitePermits, toSafeTask } from "./safety";
import { F0_1_FILE } from "./test-responses";

function element(html: string): Element {
  document.body.innerHTML = html;
  return document.body.querySelector("[data-target]") as Element;
}

describe("refusalFor (F0-08)", () => {
  test("refuses to press Simpan, Kirim or Hapus whatever verb asks for it, but may point at them", () => {
    const simpan = element("<button data-target>Simpan</button>");
    expect(refusalFor({ verb: "clickMenu", target: { text: "Simpan" } }, simpan)).toBe(
      "denied_name",
    );
    expect(
      refusalFor(
        { verb: "check", target: { text: "Kirim" }, checked: true },
        element("<button data-target>Kirim ke wali</button>"),
      ),
    ).toBe("denied_name");
    expect(
      refusalFor(
        { verb: "point", target: { text: "Simpan" }, sentence: "Silakan tekan Simpan." },
        simpan,
      ),
    ).toBeNull();
  });

  test("refuses a menu click that would submit a form, and allows plain menus and fields", () => {
    const submit = element("<form><button data-target>Tampilkan</button></form>");
    expect(refusalFor({ verb: "clickMenu", target: { text: "Tampilkan" } }, submit)).toBe(
      "submits_form",
    );
    const show = element("<button data-target>Tampilkan Siswa</button>");
    expect(refusalFor({ verb: "clickMenu", target: { text: "Tampilkan Siswa" } }, show)).toBeNull();
    const field = element("<input data-target aria-label='Nilai Budi Santoso'>");
    expect(
      refusalFor({ verb: "setValue", target: { label: "Nilai Budi Santoso" }, value: "77" }, field),
    ).toBeNull();
  });
});

describe("toSafeTask (F0-1)", () => {
  test("every fake AI response's press becomes pointing, and values lose line breaks", () => {
    expect(F0_1_FILE.respons).toHaveLength(3);
    for (const response of F0_1_FILE.respons) {
      const { task, refused } = toSafeTask(response);
      const last = task.steps.at(-1);
      expect(task.steps).toHaveLength(response.steps.length);
      // The last step tried to press something; it only points now, unless it was a valid verb
      // on a forbidden target, which the run refuses when it finds the target.
      if (response.steps.at(-1)?.verb === "clickMenu") {
        expect(refused).toEqual([]);
        expect(last).toMatchObject({ verb: "clickMenu" });
      } else {
        expect(refused).toEqual([task.steps.length - 1]);
        expect(last).toMatchObject({ verb: "point" });
      }
      for (const step of task.steps)
        if (step.verb === "setValue") expect(step.value).not.toMatch(/[\r\n]/u);
    }
  });

  test("drops a step with no usable target", () => {
    const { task } = toSafeTask({
      kind: "uji",
      title: "Uji",
      steps: [{ verb: "submit" }, { verb: "scroll", target: { label: "Catatan" } }],
    });
    expect(task.steps).toEqual([{ verb: "scroll", target: { label: "Catatan" } }]);
  });
});

describe("isTeacherInput (F0-07)", () => {
  const host = document.createElement("nemu-overlay");
  const page = document.createElement("main");
  const input = (
    fields: Partial<Parameters<typeof isTeacherInput>[0]>,
    path: EventTarget[] = [page],
  ) => ({
    type: "mousedown",
    isTrusted: true,
    composedPath: () => path,
    ...fields,
  });

  test("a real press on the page is the teacher's; Nemu's own events and its bubble are not", () => {
    expect(isTeacherInput(input({}), host)).toBe(true);
    expect(isTeacherInput(input({ type: "keydown", key: "7" }), host)).toBe(true);
    expect(isTeacherInput(input({ isTrusted: false }), host)).toBe(false);
    expect(isTeacherInput(input({}, [page, host]), host)).toBe(false);
    expect(isTeacherInput(input({ type: "mousemove" }), host)).toBe(false);
  });

  test("holding Ctrl + Space to talk pauses through voice instead of interrupting", () => {
    expect(isTeacherInput(input({ type: "keydown", key: "Control", ctrlKey: true }), host)).toBe(
      false,
    );
    expect(isTeacherInput(input({ type: "keydown", key: " ", ctrlKey: true }), host)).toBe(false);
  });

  test("the school's own talk combination (WS-08) doesn't interrupt either; N alone still does", () => {
    const altShiftN = { ctrl: false, alt: true, shift: true, meta: false, code: "KeyN" };
    const keyN = { type: "keydown", key: "N", code: "KeyN" };
    expect(isTeacherInput(input({ ...keyN, altKey: true, shiftKey: true }), host, altShiftN)).toBe(
      false,
    );
    expect(isTeacherInput(input(keyN), host, altShiftN)).toBe(true);
  });
});

describe("guardSubmits (F0-08)", () => {
  test("cancels an untrusted submit, and every submit while Nemu acts, until removed", () => {
    document.body.innerHTML = "<form><input></form>";
    const form = document.querySelector("form") as HTMLFormElement;
    let acting = true;
    const remove = guardSubmits(document, () => acting);

    const submit = () => {
      const event = new Event("submit", { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(submit()).toBe(true);
    acting = false;
    // Still untrusted, so still cancelled.
    expect(submit()).toBe(true);
    remove();
    expect(submit()).toBe(false);
  });
});

describe("sitePermits (WS-03)", () => {
  test("'baca dan isi' permits every verb; 'baca saja' only pointing and scrolling", () => {
    for (const verb of [
      "point",
      "scroll",
      "setValue",
      "selectOption",
      "check",
      "clickMenu",
    ] as const)
      expect(sitePermits("read_fill", verb)).toBe(true);
    expect(sitePermits("read_only", "point")).toBe(true);
    expect(sitePermits("read_only", "scroll")).toBe(true);
    for (const verb of ["setValue", "selectOption", "check", "clickMenu"] as const)
      expect(sitePermits("read_only", verb)).toBe(false);
  });

  test("'siapkan pesan' lets Nemu type the message and nothing else", () => {
    expect(sitePermits("prepare_message", "setValue")).toBe(true);
    for (const verb of ["selectOption", "check", "clickMenu"] as const)
      expect(sitePermits("prepare_message", verb)).toBe(false);
  });
});
