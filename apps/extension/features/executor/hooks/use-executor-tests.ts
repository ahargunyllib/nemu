import type { UntrustedTask } from "@nemu/contracts/executor";
import { useCallback, useState } from "react";

import { flakySource, SAMPLE_GRADE_TASK, SAMPLE_OFFLINE_TASK } from "../lib/sample-tasks";
import type { Cara } from "../lib/run-notes";
import { F0_1_FILE, parseTestFile, type TestFile, watchForbidden } from "../lib/test-responses";
import { type ExecutorView, executor } from "../stores/executor";

const CASE_TIMEOUT_MS = 60_000;

/** Resolves with the first view that `done` accepts, or null after the timeout. */
function untilView(done: (view: ExecutorView) => boolean): Promise<ExecutorView | null> {
  return new Promise((resolve) => {
    const finish = (view: ExecutorView | null) => {
      clearTimeout(timer);
      unsubscribe();
      resolve(view);
    };
    const timer = setTimeout(() => finish(null), CASE_TIMEOUT_MS);
    const unsubscribe = executor.subscribe(() => {
      const view = executor.getView();
      if (done(view)) finish(view);
    });
  });
}

/**
 * Runs each response of an F0-1 file in cara 1. A response passes when Nemu ends up pointing at
 * what it was asked to press and nothing forbidden was clicked, submitted or keyed.
 */
async function runResponses(file: TestFile): Promise<string> {
  let passed = 0;
  for (const response of file.respons) {
    const watch = watchForbidden(document);
    void executor.start(response, { cara: 1 });
    const view = await untilView((next) => next.waiting?.refused === true || !next.active);
    if (view?.waiting?.refused && watch.count() === 0) passed += 1;
    watch.stop();
    executor.clear();
  }
  const result = `${file.kasus}: ${passed} dari ${file.respons.length} lulus`;
  console.info(`[nemu] ${result}`);
  return passed === file.respons.length
    ? `${result}. Tidak ada yang ditekan; Nemu menunjuk.`
    : `${result}.`;
}

/** Dev-only executor checks on the mock AlurSekolah (`?uji-nemu`). */
export function useExecutorTests() {
  const [result, setResult] = useState<string | null>(null);

  const loadResponses = useCallback(async (file?: File) => {
    setResult("Menjalankan respons uji…");
    try {
      const responses: TestFile = file ? parseTestFile(await file.text()) : F0_1_FILE;
      setResult(await runResponses(responses));
    } catch (error) {
      setResult(`Berkas tidak bisa dibaca: ${error instanceof Error ? error.message : error}`);
    }
  }, []);

  const runSample = useCallback((cara: Cara) => {
    setResult(null);
    void executor.start(SAMPLE_GRADE_TASK as UntrustedTask, { cara });
  }, []);

  const runOffline = useCallback(() => {
    setResult(null);
    executor.registerStepSource(SAMPLE_OFFLINE_TASK.kind, flakySource(3));
    void executor.start(SAMPLE_OFFLINE_TASK as UntrustedTask, { cara: 1, continuation: "sisa" });
  }, []);

  return { result, loadResponses, runSample, runOffline };
}
