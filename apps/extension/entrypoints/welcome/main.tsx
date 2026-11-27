import { Button } from "@nemu/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { shortcutKeys } from "@nemu/contracts/talk-shortcut";
import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";

import { useSchoolShortcut } from "../../features/voice/hooks/use-school-shortcut";
import { MicrophoneStep } from "../../features/welcome/components/microphone-step";
import { useMicrophonePermission } from "../../features/welcome/hooks/use-microphone-permission";

import "./style.css";

/**
 * Opens after install (#200): the microphone permission is asked here, once, for the whole
 * extension. The settings page, where the operator enters the install code, is one click on.
 */
function WelcomePage() {
  const { permission, ask } = useMicrophonePermission();
  const shortcut = useSchoolShortcut();

  return (
    <main className="flex min-h-svh flex-col items-center gap-6 bg-muted px-6 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Selamat datang di Nemu</CardTitle>
          <CardDescription>
            Nemu mendengar dan menjawab dengan suara. Izinkan mikrofon sekali saja di sini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MicrophoneStep
            permission={permission}
            shortcutKeys={shortcutKeys(shortcut)}
            onAsk={() => void ask()}
          />
        </CardContent>
      </Card>

      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Kode pemasangan sekolah</CardTitle>
          <CardDescription>
            Operator sekolah mengisi kode pemasangan sekali di pengaturan Nemu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={() => void browser.runtime.openOptionsPage()}
          >
            Buka pengaturan Nemu
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<WelcomePage />);
