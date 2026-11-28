import { Kbd, KbdGroup } from "@nemu/ui/components/kbd";
import { Fragment } from "react";

/** How to talk to Nemu, and what Chrome asks the first time (ADR-0019). */
export function TalkStep({ shortcutKeys }: { shortcutKeys: readonly string[] }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        Di AlurSekolah, tahan{" "}
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
      <p className="text-muted-foreground">
        Saat pertama kali bicara di sebuah situs, Chrome meminta izin mikrofon. Nemu menunjuk tombol
        Izinkan yang perlu ditekan.
      </p>
    </div>
  );
}
