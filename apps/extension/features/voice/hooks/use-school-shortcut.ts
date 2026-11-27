import type { TalkShortcut } from "@nemu/contracts/talk-shortcut";
import { useEffect, useState } from "react";

import { siteConfigItem } from "../../../shared/lib/extension-storage";
import { talkShortcutFrom } from "../lib/talk-shortcut";

/** The school's WS-08 talk combination as last read, for pages outside a website (welcome). */
export function useSchoolShortcut(): TalkShortcut {
  const [setting, setSetting] = useState<string | undefined>(undefined);
  useEffect(() => {
    void siteConfigItem.getValue().then((config) => setSetting(config?.settings?.talkShortcut));
    return siteConfigItem.watch((config) => setSetting(config?.settings?.talkShortcut));
  }, []);
  return talkShortcutFrom(setting);
}
