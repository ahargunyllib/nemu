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
import { TalkStep } from "../../features/welcome/components/talk-step";

import "./style.css";

/**
 * Opens after install (#200): how to talk to Nemu. The microphone is asked for on each site the
 * first time the teacher talks there (ADR-0019). The settings page, where the operator enters the
 * install code, is one click on.
 */
function WelcomePage() {
  const shortcut = useSchoolShortcut();

  return (
    <main className="flex min-h-svh flex-col items-center gap-6 bg-muted px-6 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Selamat datang di Nemu</CardTitle>
          <CardDescription>Nemu mendengar dan menjawab dengan suara.</CardDescription>
        </CardHeader>
        <CardContent>
          <TalkStep shortcutKeys={shortcutKeys(shortcut)} />
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
