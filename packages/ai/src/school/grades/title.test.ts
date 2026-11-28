import assert from "node:assert/strict";
import test from "node:test";

import { fakeJsonCall } from "../test-helpers.js";
import { readPhotoTitle } from "./title.js";

const PHOTO = { type: "image", dataUrl: "data:image/jpeg;base64,AA==" } as const;
const HEADING = "Daftar Nilai UTS Matematika - Kelas 4B";

const read = (heading: string | null, candidates: unknown[]) =>
  readPhotoTitle(fakeJsonCall({ grade_book_title: { heading, candidates } }), PHOTO);

test("#269: the official F1-1 heading gives UTS · Matematika · 4B", async () => {
  const call = fakeJsonCall({
    grade_book_title: {
      heading: HEADING,
      candidates: [{ assessment: " UTS", subject: "Matematika ", className: "Kelas 4B" }],
    },
  });
  assert.deepEqual(await readPhotoTitle(call, PHOTO), [
    { assessment: "UTS", subject: "Matematika", className: "4B" },
  ]);
  assert.deepEqual(call.calls[0]!.content, [PHOTO]);
});

test("#269: a heading without a class leaves the class to ask for", async () => {
  assert.deepEqual(
    await read("Nilai UH 2 IPA", [{ assessment: "UH 2", subject: "IPA", className: null }]),
    [{ assessment: "UH 2", subject: "IPA", className: null }],
  );
});

test("#269: a choice the heading doesn't say is never offered", async () => {
  assert.deepEqual(
    await read(HEADING, [
      { assessment: "UAS", subject: "Matematika", className: "4B" },
      { assessment: "UTS", subject: "Bahasa Indonesia", className: "4B" },
      { assessment: "UTS", subject: "Matematika", className: "4A" },
      { assessment: "UTS", subject: "Matematika", className: "4B" },
    ]),
    [{ assessment: "UTS", subject: "Matematika", className: "4B" }],
  );
});

test("#269: no heading gives no choices, so Nemu asks", async () => {
  for (const heading of [null, "", "  "])
    assert.deepEqual(
      await read(heading, [{ assessment: "UTS", subject: "Matematika", className: "4B" }]),
      [],
    );
});
