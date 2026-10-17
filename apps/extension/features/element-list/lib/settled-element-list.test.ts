// @vitest-environment happy-dom
import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { SETTLE_MS, SETTLE_TIMEOUT_MS, collectSettledElementList } from "./settled-element-list";

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
