import assert from "node:assert/strict";
import { test } from "node:test";

import * as fixtures from "./fixtures.js";
import { nemuIdSchema } from "./index.js";
import { ALL_NEMU_IDS } from "./nemu-ids.js";

test("every registered nemu_id is a valid, unique wire id", () => {
  for (const id of ALL_NEMU_IDS) {
    assert.ok(nemuIdSchema.safeParse(id).success, `invalid nemu_id: ${id}`);
  }
  assert.equal(new Set(ALL_NEMU_IDS).size, ALL_NEMU_IDS.length, "nemu_ids must be unique");
});

test("fixtures only reference registered nemu_ids", () => {
  const registered = new Set<string>(ALL_NEMU_IDS);

  for (const [name, fixture] of Object.entries(fixtures)) {
    const referenced =
      "elements" in fixture
        ? fixture.elements.map((element) => element.nemu_id)
        : fixture.actions.map((action) => action.target);

    for (const id of referenced) {
      assert.ok(registered.has(id), `${name} references unregistered nemu_id ${id}`);
    }
  }
});
