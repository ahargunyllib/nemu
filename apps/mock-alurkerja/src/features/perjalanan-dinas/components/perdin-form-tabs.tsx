import { Tabs, TabsContent, TabsList, TabsTrigger } from "@nemu/ui/components/tabs";
import { cn } from "@nemu/ui/lib/utils";

import BiayaSection from "@/features/perjalanan-dinas/components/biaya-section";
import DokumenSection from "@/features/perjalanan-dinas/components/dokumen-section";
import JadwalSection from "@/features/perjalanan-dinas/components/jadwal-section";
import JenisTujuanSection from "@/features/perjalanan-dinas/components/jenis-tujuan-section";
import type { AjukanPerdinForm } from "@/features/perjalanan-dinas/hooks/use-ajukan-perdin-form";
import { usePerdinErrors } from "@/features/perjalanan-dinas/hooks/use-perdin-errors";
import {
  PERDIN_TABS,
  type PerdinTab,
  tabsWithErrors,
} from "@/features/perjalanan-dinas/lib/perdin-form";

/** The form's four tabs; only the open tab's fields render, and a tab with an error shows a dot. */
export default function PerdinFormTabs({
  form,
  tab,
  onTabChange,
}: {
  form: AjukanPerdinForm;
  tab: PerdinTab;
  onTabChange: (tab: PerdinTab) => void;
}) {
  const invalidTabs = tabsWithErrors(usePerdinErrors(form));

  return (
    <Tabs value={tab} onValueChange={(next) => onTabChange(next as PerdinTab)} className="gap-3">
      <TabsList>
        {PERDIN_TABS.map((tab, index) => {
          const invalid = invalidTabs.includes(tab.value);
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              data-nemu-id={tab.nemuId}
              aria-label={invalid ? `${tab.label}, ada isian yang perlu diperbaiki` : tab.label}
              className="flex-none px-3"
            >
              {index + 1} {tab.label}
              <span
                aria-hidden
                className={cn("size-1.5 rounded-full bg-destructive", !invalid && "invisible")}
              />
            </TabsTrigger>
          );
        })}
      </TabsList>
      <TabsContent value="jenis-tujuan">
        <JenisTujuanSection form={form} />
      </TabsContent>
      <TabsContent value="jadwal">
        <JadwalSection form={form} />
      </TabsContent>
      <TabsContent value="biaya">
        <BiayaSection form={form} />
      </TabsContent>
      <TabsContent value="dokumen">
        <DokumenSection form={form} />
      </TabsContent>
    </Tabs>
  );
}
