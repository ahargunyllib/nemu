import { Button } from "@nemu/ui/components/button";
import { Kbd, KbdGroup } from "@nemu/ui/components/kbd";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { Mic } from "lucide-react";
import { Fragment } from "react";

import type { MicrophonePermission } from "../hooks/use-microphone-permission";

type MicrophoneStepProps = {
  permission: MicrophonePermission;
  shortcutKeys: readonly string[];
  onAsk: () => void;
};

/** Asks for the microphone once, then says how to talk to Nemu. */
export function MicrophoneStep({ permission, shortcutKeys, onAsk }: MicrophoneStepProps) {
  if (permission === "checking") return <Skeleton className="h-9 w-48" />;
  if (permission === "granted")
    return (
      <p className="text-sm">
        Mikrofon siap. Di AlurSekolah, tahan{" "}
        <KbdGroup>
          {shortcutKeys.map((key, index) => (
            <Fragment key={key}>
              {index > 0 && "+"}
              <Kbd>{key}</Kbd>
            </Fragment>
          ))}
        </KbdGroup>{" "}
        sambil bicara, lalu lepaskan. Bisa juga dengan menahan tombol Nemu.
      </p>
    );
  return (
    <div className="flex flex-col items-start gap-3">
      {permission === "denied" && (
        <p className="text-sm text-destructive">
          Mikrofon ditolak. Klik ikon di kiri alamat halaman ini, pilih Izinkan untuk Mikrofon, lalu
          muat ulang halaman.
        </p>
      )}
      {permission === "unavailable" && (
        <p className="text-sm text-destructive">
          Mikrofon tidak ditemukan. Pasang mikrofon atau headset, lalu coba lagi.
        </p>
      )}
      <Button type="button" onClick={onAsk}>
        <Mic />
        Izinkan mikrofon
      </Button>
    </div>
  );
}
