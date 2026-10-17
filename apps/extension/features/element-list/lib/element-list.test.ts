// @vitest-environment happy-dom
import { nemuRequestSchema } from "@nemu/contracts";
import { momentTwoRequest } from "@nemu/contracts/fixtures";
import { afterEach, describe, expect, test } from "vite-plus/test";

import { MAX_ELEMENTS, MAX_PAYLOAD_BYTES, collectElementList } from "./element-list";

const ON_SCREEN = { left: 40, top: 100, width: 200, height: 32 };

afterEach(() => {
  document.body.innerHTML = "";
});

/** happy-dom has no layout, so give every `data-nemu-id` element a box: on screen by default. */
function renderPage(html: string, boxes: Record<string, typeof ON_SCREEN> = {}) {
  document.body.innerHTML = html;
  for (const element of document.querySelectorAll<HTMLElement>("[data-nemu-id]")) {
    const { left, top, width, height } = boxes[element.dataset.nemuId ?? ""] ?? ON_SCREEN;
    element.getBoundingClientRect = () => new DOMRect(left, top, width, height);
  }
}

describe("collectElementList", () => {
  test("lists the Momen 2 lodging elements the way the contract fixture does", () => {
    renderPage(`
      <div role="radiogroup">
        <button role="radio" data-nemu-id="opt-penginapan-tidak-hotel">Tidak menginap di hotel</button>
      </div>
      <label for="nominal">Nominal penginapan</label>
      <input id="nominal" data-nemu-id="input-nominal-penginapan" />
    `);

    const elements = collectElementList(document);

    expect(elements.map(({ position: _position, ...element }) => element)).toEqual(
      momentTwoRequest.elements,
    );
    expect(elements[0]?.position).toEqual({ x: 40, y: 100, width: 200, height: 32 });
    expect(nemuRequestSchema.safeParse({ ...momentTwoRequest, elements }).success).toBe(true);
  });

  test("skips elements without a valid data-nemu-id", () => {
    renderPage(`
      <button>Tanpa nemu_id</button>
      <a href="/" data-nemu-id="menu-beranda">Beranda</a>
      <button data-nemu-id="bukan id valid!">Id tidak valid</button>
      <button data-nemu-id="">Kosong</button>
    `);

    expect(collectElementList(document).map((element) => element.nemu_id)).toEqual([
      "menu-beranda",
    ]);
  });

  test("never includes what the user typed or chose", () => {
    renderPage(`
      <input data-nemu-id="input-nominal-penginapan" aria-label="Nominal penginapan" value="447000" />
      <textarea data-nemu-id="input-catatan" placeholder="Catatan">rahasia</textarea>
      <div data-nemu-id="field-alasan">Alasan <textarea>rahasia juga</textarea></div>
      <select data-nemu-id="select-provinsi"><option selected>Sulawesi Selatan</option></select>
    `);
    const typed = document.querySelector<HTMLInputElement>("input");
    if (typed) typed.value = "Rp447.000";

    const payload = JSON.stringify(collectElementList(document));

    expect(payload).not.toMatch(/447|rahasia|Sulawesi/u);
    expect(collectElementList(document).map((element) => element.label)).toEqual([
      "Nominal penginapan",
      "Catatan",
      "Alasan",
      "select-provinsi",
    ]);
  });

  test("leaves out hidden elements and marks off-screen ones not visible, after on-screen ones", () => {
    renderPage(
      `
        <button data-nemu-id="button-kirim">Kirim</button>
        <a href="/" data-nemu-id="menu-beranda">Beranda</a>
        <button data-nemu-id="button-tersembunyi" style="visibility: hidden">Tersembunyi</button>
        <button data-nemu-id="button-tanpa-ukuran">Tanpa ukuran</button>
      `,
      {
        "button-kirim": { left: 40, top: 2_000, width: 120, height: 36 },
        "button-tanpa-ukuran": { left: 0, top: 0, width: 0, height: 0 },
      },
    );

    expect(
      collectElementList(document).map(({ nemu_id, visible }) => ({ nemu_id, visible })),
    ).toEqual([
      { nemu_id: "menu-beranda", visible: true },
      { nemu_id: "button-kirim", visible: false },
    ]);
  });

  test("keeps at most 150 elements and stays under 50 KB", () => {
    const longLabel = "Label panjang ".repeat(40);
    renderPage(
      Array.from(
        { length: 400 },
        (_, index) => `<button data-nemu-id="button-${index}">${longLabel}${index}</button>`,
      ).join(""),
    );

    const elements = collectElementList(document);

    expect(elements.length).toBeLessThanOrEqual(MAX_ELEMENTS);
    expect(new TextEncoder().encode(JSON.stringify(elements)).length).toBeLessThan(
      MAX_PAYLOAD_BYTES,
    );
    expect(nemuRequestSchema.safeParse({ ...momentTwoRequest, elements }).success).toBe(true);
  });

  test("stops at 150 elements when labels are short", () => {
    renderPage(
      Array.from(
        { length: 200 },
        (_, index) => `<button data-nemu-id="button-${index}">Tombol ${index}</button>`,
      ).join(""),
    );

    expect(collectElementList(document)).toHaveLength(MAX_ELEMENTS);
  });
});
