// @vitest-environment happy-dom
import type { RecordedEvent } from "@nemu/contracts/school";
import { beforeEach, describe, expect, test } from "vite-plus/test";

import { captureEvents } from "./capture";

/** F3-01 "Rekam cara" (#214): what the operator does, as locators; never a password's value. */
beforeEach(() => {
  document.body.innerHTML = `
    <nav><a href="#/tahfidz" id="menu-alquran">Al-Quran</a></nav>
    <p id="teks">Teks biasa</p>
    <label for="kelas">Kelas</label><select id="kelas"><option value="">Pilih</option><option>4A</option></select>
    <label for="nilai">Fashohah</label><input type="number" id="nilai">
    <label for="sandi">Kata sandi</label><input type="password" id="sandi">
    <button id="simpan">Simpan ujian</button>
    <nemu-overlay><button>Selesai</button></nemu-overlay>`;
});

function record(run: () => void): RecordedEvent[] {
  const events: RecordedEvent[] = [];
  const stop = captureEvents(
    document,
    Date.now(),
    (event) => events.push(event),
    () => true,
  );
  run();
  stop();
  return events;
}

const fire = (selector: string, type: string) =>
  document.querySelector(selector)!.dispatchEvent(new Event(type, { bubbles: true }));

describe("Rekam cara capture", () => {
  test("clicks, choices and typing become locators by role and label", () => {
    const events = record(() => {
      fire("#menu-alquran", "click");
      const kelas = document.querySelector<HTMLSelectElement>("#kelas")!;
      kelas.value = "4A";
      fire("#kelas", "change");
      document.querySelector<HTMLInputElement>("#nilai")!.value = "90";
      fire("#nilai", "input");
      fire("#simpan", "click");
    });
    expect(
      events.map((event) => [
        event.type,
        event.locator.role,
        event.locator.label ?? event.locator.name,
        event.value,
      ]),
    ).toEqual([
      ["click", "link", "Al-Quran", null],
      ["change", "combobox", "Kelas", "4A"],
      ["input", "textbox", "Fashohah", "90"],
      ["click", "button", "Simpan ujian", null],
    ]);
    expect(events[0]?.locator.css).toBe("#menu-alquran");
  });

  test("a password's value is never kept; Nemu's own buttons and plain text are left out", () => {
    const events = record(() => {
      document.querySelector<HTMLInputElement>("#sandi")!.value = "rahasia";
      fire("#sandi", "input");
      fire("#teks", "click");
      fire("nemu-overlay button", "click");
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "input", value: null });
    expect(JSON.stringify(events)).not.toContain("rahasia");
  });

  test("a script-made click isn't the operator's; a value a custom select sets is kept", () => {
    const events: RecordedEvent[] = [];
    const stop = captureEvents(document, Date.now(), (event) => events.push(event));
    fire("#simpan", "click");
    document.querySelector<HTMLSelectElement>("#kelas")!.value = "4A";
    fire("#kelas", "change");
    stop();
    expect(events.map((event) => [event.type, event.locator.label])).toEqual([["change", "Kelas"]]);
  });
});
