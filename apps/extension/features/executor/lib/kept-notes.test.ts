import { describe, expect, test } from "vite-plus/test";

import type { StepNotes } from "../api/request-run-storage";
import { KEPT_NOTES, withNotes } from "./kept-notes";

const notes = (title: string, items: string[] = []): StepNotes => ({ title, items });

describe("the notes a site keeps for the Nemu button (F1·12a)", () => {
  test("newest first, one per recipe, at most a few", () => {
    let kept: StepNotes[] = [];
    kept = withNotes(kept, notes("Cara isi nilai kelas", ["lama"]));
    kept = withNotes(kept, notes("Cara pasang kuis"));
    kept = withNotes(kept, notes("Cara isi nilai kelas", ["baru"]));
    expect(kept).toEqual([notes("Cara isi nilai kelas", ["baru"]), notes("Cara pasang kuis")]);
    for (let index = 0; index < 10; index += 1) kept = withNotes(kept, notes(`Cara ${index}`));
    expect(kept).toHaveLength(KEPT_NOTES);
    expect(kept[0]?.title).toBe("Cara 9");
  });
});
