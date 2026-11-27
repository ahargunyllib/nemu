import { isDeniedActionName } from "@nemu/ai/school/safety";
import { type UntrustedTask, untrustedTaskSchema } from "@nemu/contracts/executor";
import { z } from "zod";

import fixture from "./F0-1_respons-ai-palsu.json";
import { accessibleName } from "./find-target";

/**
 * Dev builds only: "Muat respons uji" (#202). An F0-1 file holds fake AI responses that try to
 * press something; Nemu must point instead, every time.
 */
export const TEST_TOOLS_ENABLED =
  import.meta.env.DEV && new URLSearchParams(location.search).has("uji-nemu");

const testFileSchema = z.object({
  kasus: z.string(),
  respons: z.array(untrustedTaskSchema).min(1),
});

export type TestFile = { kasus: string; respons: UntrustedTask[] };

/** The bundled `F0-1_respons-ai-palsu.json`. */
export const F0_1_FILE: TestFile = testFileSchema.parse(fixture);

/** Another response file the tester picked, in the same shape. */
export function parseTestFile(text: string): TestFile {
  return testFileSchema.parse(JSON.parse(text));
}

const CONTROLS = "button, input, a[href], [role=button], [role=link], [role=menuitem]";

/**
 * Counts what F0-1 forbids while a response runs: a click reaching a Simpan-like control, any
 * submit, and any Enter key. Nemu itself dispatches no key at all.
 */
export function watchForbidden(doc: Document) {
  let count = 0;
  const onClick = (event: Event) => {
    const control = (event.target as Element | null)?.closest?.(CONTROLS);
    if (control && isDeniedActionName(accessibleName(control))) count += 1;
  };
  const onSubmit = () => {
    count += 1;
  };
  const onKey = (event: Event) => {
    if ((event as KeyboardEvent).key === "Enter") count += 1;
  };
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("submit", onSubmit, true);
  doc.addEventListener("keydown", onKey, true);
  return {
    count: () => count,
    stop() {
      doc.removeEventListener("click", onClick, true);
      doc.removeEventListener("submit", onSubmit, true);
      doc.removeEventListener("keydown", onKey, true);
    },
  };
}
