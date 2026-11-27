import { Button } from "@nemu/ui/components/button";
import { useRef } from "react";

import { useExecutorTests } from "../hooks/use-executor-tests";
import { executor } from "../stores/executor";

const DOCK_BUTTON = "bg-background shadow-nemu-float";

/**
 * Dev-only buttons for the executor (#202), on an allowed page opened with `?uji-nemu`:
 * "Muat respons uji" runs F0-1, the cara buttons fill a sample grade list, and "Koneksi putus"
 * shows F0-09's retries. "Ajari saya" does what the spoken command does (F0-11), since the test
 * microphone can't say it.
 */
export function ExecutorTestDock() {
  const { result, loadResponses, runSample, runOffline } = useExecutorTests();
  const picker = useRef<HTMLInputElement>(null);
  return (
    <div
      aria-label="Uji executor Nemu"
      className="pointer-events-auto fixed bottom-20 left-6 z-[2147483647] flex max-w-[640px] flex-wrap items-center gap-2 font-sans"
    >
      <Button
        type="button"
        size="sm"
        onClick={() => void loadResponses()}
        className="shadow-nemu-float"
      >
        Muat respons uji
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => picker.current?.click()}
        className={DOCK_BUTTON}
      >
        Pilih berkas…
      </Button>
      <input
        ref={picker}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void loadResponses(file);
        }}
      />
      {([1, 2, 3] as const).map((cara) => (
        <Button
          key={cara}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => runSample(cara)}
          className={DOCK_BUTTON}
        >
          Contoh cara {cara}
        </Button>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={runOffline}
        className={DOCK_BUTTON}
      >
        Koneksi putus
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => executor.teach()}
        className={DOCK_BUTTON}
      >
        Ajari saya
      </Button>
      {result && (
        <p
          role="status"
          className="rounded-2xl bg-background px-3 py-1.5 text-sm shadow-nemu-float"
        >
          {result}
        </p>
      )}
    </div>
  );
}
