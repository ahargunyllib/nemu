import { useEffect, useState } from "react";

import { siteConfigItem } from "../../../shared/lib/extension-storage";

/** The installed school's name as last read ("SDIT Nusantara"), or null before it is known. */
export function useSchoolName(): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    void siteConfigItem.getValue().then((config) => setName(config?.schoolName ?? null));
    return siteConfigItem.watch((config) => setName(config?.schoolName ?? null));
  }, []);
  return name;
}
