import assert from "node:assert/strict";
import { test } from "node:test";

import * as fixtures from "./fixtures.js";
import { nemuRequestSchema, nemuResponseSchema } from "./index.js";

test("every fixture validates against its wire schema", () => {
  for (const [name, fixture] of Object.entries(fixtures)) {
    const schema = "elements" in fixture ? nemuRequestSchema : nemuResponseSchema;
    const result = schema.safeParse(fixture);

    assert.ok(result.success, `${name} is invalid: ${result.error?.message}`);
  }
});
