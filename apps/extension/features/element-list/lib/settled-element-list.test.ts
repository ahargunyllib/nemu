// @vitest-environment happy-dom
import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import {
  SETTLE_MS,
  SETTLE_TIMEOUT_MS,
  collectSettledElementList,
  pageNemuIds,
} from "./settled-element-list";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

/** Adds a page element with a box, since happy-dom has no layout. */
function addTarget(nemuId: string) {
  const element = document.createElement("button");
  element.dataset.nemuId = nemuId;
  element.textContent = nemuId;
  element.getBoundingClientRect = () => new DOMRect(40, 300, 200, 32);
  document.body.append(element);
}

function ids(elements: { nemu_id: string }[]) {
  return elements.map(({ nemu_id }) => nemu_id);
}

describe("collectSettledElementList", () => {
  test("waits for the task page to finish loading before collecting its elements", async () => {
    vi.useFakeTimers();
    addTarget(NEMU_IDS.taskDetail.back);
    const skeleton = document.createElement("div");
    skeleton.dataset.slot = "skeleton";
    document.body.append(skeleton);

    const collected = collectSettledElementList(new AbortController().signal);
    await vi.advanceTimersByTimeAsync(SETTLE_MS * 2);
    // The task data arrives: the Skeleton gives way to the uploads and Kirim.
    skeleton.remove();
    addTarget(NEMU_IDS.pertanggungjawaban.uploadLaporanPerjalanan);
    addTarget(NEMU_IDS.pertanggungjawaban.kirim);
    await vi.advanceTimersByTimeAsync(SETTLE_MS * 2);

    expect(ids(await collected)).toEqual([
      NEMU_IDS.taskDetail.back,
      NEMU_IDS.pertanggungjawaban.uploadLaporanPerjalanan,
      NEMU_IDS.pertanggungjawaban.kirim,
    ]);
  });

  test("waits while the page being left is still on screen after the URL changed", async () => {
    vi.useFakeTimers();
    // Beranda, still showing while the router checks the session for the form's route.
    addTarget(NEMU_IDS.shell.menuAjukanPerjalananDinas);
    addTarget(NEMU_IDS.task.pertanggungjawaban);
    const leaving = pageNemuIds();

    const collected = collectSettledElementList(new AbortController().signal, { leaving });
    await vi.advanceTimersByTimeAsync(SETTLE_MS * 4);
    // The form replaces Beranda; the side menu stays.
    document.querySelector(`[data-nemu-id="${NEMU_IDS.task.pertanggungjawaban}"]`)?.remove();
    addTarget(NEMU_IDS.perdinForm.jenisPerjalanan);
    await vi.advanceTimersByTimeAsync(SETTLE_MS * 2);

    expect(ids(await collected)).toEqual([
      NEMU_IDS.shell.menuAjukanPerjalananDinas,
      NEMU_IDS.perdinForm.jenisPerjalanan,
    ]);
  });

  test("gives up waiting on a page that never settles", async () => {
    vi.useFakeTimers();
    const skeleton = document.createElement("div");
    skeleton.dataset.slot = "skeleton";
    document.body.append(skeleton);
    addTarget(NEMU_IDS.taskDetail.back);

    const collected = collectSettledElementList(new AbortController().signal);
    await vi.advanceTimersByTimeAsync(SETTLE_TIMEOUT_MS + 100);

    expect(ids(await collected)).toEqual([NEMU_IDS.taskDetail.back]);
  });
});
