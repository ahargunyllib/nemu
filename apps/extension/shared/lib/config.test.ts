import { describe, expect, test } from "vite-plus/test";

import { demoAppUrl } from "./config";

describe("demoAppUrl", () => {
  test("opens the Demo App that goes with the Nemu Service the build calls", () => {
    expect(demoAppUrl("http://localhost:3000")).toBe("http://localhost:3001");
    expect(demoAppUrl("https://nemu-api.ahargunyllib.dev")).toBe(
      "https://nemu-mock-alurkerja.ahargunyllib.dev",
    );
  });
});
